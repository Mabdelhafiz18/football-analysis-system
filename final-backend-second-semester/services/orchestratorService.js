import visionClientService from './visionClientService.js';
import tacticalClientService from './tacticalClientService.js';
import xgClientService from './xgClientService.js';
import offsideClientService from './offsideClientService.js';
import foulClientService from './foulClientService.js';
import jobService from './jobService.js';
import modelResultService from './modelResultService.js';
import liveEventService from './liveEventService.js';
import config from '../config/config.js';
import { createLimiter, toPositiveInteger } from '../utils/asyncUtils.js';

class OrchestratorService {
  startProcessing(matchInfo) {
    const matchId = parseInt(matchInfo.match_id, 10);

    console.log('[Orchestrator] Starting live Vision + Tactical + xG + Offside + Foul for match ' + matchId);

    liveEventService.emitMatchStatus(matchId, {
      status: 'started',
      message: 'Live AI pipeline started',
      progress: 5
    });

    this._runLivePipeline(matchId, matchInfo).catch(async (err) => {
      console.error('[Orchestrator] Processing failed:', err.message);
      console.error(err.stack);

      liveEventService.emitMatchStatus(matchId, {
        status: 'failed',
        message: err.message,
        progress: 0
      });

      await jobService.failJob(matchId, err.message);
    });

    return {
      status: 'started',
      match_id: matchId
    };
  }

  async _runLivePipeline(matchId, matchInfo) {
    if (!matchInfo.video_path) {
      throw new Error('Video path is missing');
    }

    await jobService.updateJobProgress(
      matchId,
      5,
      'Starting Vision + Tactical + xG + Offside + Foul live pipeline...'
    );

    let packetsCount = 0;
    let windowNumber = 0;
    let windowPackets = [];
    let lastProgressUpdate = Date.now();
    let foulTaskChain = Promise.resolve();

    const modelTasks = [];
    const WINDOW_SIZE = toPositiveInteger(config.orchestration.windowSize, 50);
    const modelWindowLimiter = createLimiter(
      config.orchestration.modelWindowConcurrency
    );

    const emitAndSaveResult = (
      modelName,
      currentWindowNumber,
      status,
      result,
      errorMessage = null
    ) => {
      const payload = {
        model_name: modelName,
        window_number: currentWindowNumber,
        status: status,
        timestamp: new Date().toISOString()
      };

      if (result !== undefined && result !== null) {
        payload.result = result;
      }

      if (errorMessage) {
        payload.error = errorMessage;
      }

      liveEventService.emitModelResult(matchId, payload);

      console.log(
        '[Live] Emitted ' +
          modelName +
          ' window ' +
          currentWindowNumber +
          ' to frontend'
      );

      if (status === 'completed') {
        modelResultService
          .saveWindowResult(matchId, modelName, currentWindowNumber, result)
          .catch((dbErr) => {
            console.warn('[DB] Background save failed for ' + modelName + ':', dbErr.message);
          });
      } else {
        modelResultService
          .saveWindowError(matchId, modelName, currentWindowNumber, errorMessage)
          .catch((dbErr) => {
            console.warn('[DB] Background error save failed for ' + modelName + ':', dbErr.message);
          });
      }
    };

    const runModelWindow = async (
      modelName,
      clientService,
      ndjsonText,
      currentWindowNumber
    ) => {
      try {
        const result = await clientService.analyzeWindow(
          matchId,
          ndjsonText,
          currentWindowNumber
        );

        emitAndSaveResult(
          modelName,
          currentWindowNumber,
          'completed',
          result
        );

        return result;
      } catch (err) {
        emitAndSaveResult(
          modelName,
          currentWindowNumber,
          'failed',
          null,
          err.message
        );

        console.warn(
          '[' + modelName + '] Window ' + currentWindowNumber + ' failed:',
          err.message
        );

        return null;
      }
    };

    const runFoulClipWindow = async (
      ndjsonText,
      currentWindowNumber,
      windowStartTime,
      windowEndTime
    ) => {
      try {
        liveEventService.emitModelResult(matchId, {
          model_name: 'foul_candidate',
          window_number: currentWindowNumber,
          status: 'processing',
          message: 'GPU clip verification started',
          timestamp: new Date().toISOString()
        });

        const result = await foulClientService.analyzeClipWindow({
          matchId: matchId,
          videoPath: matchInfo.video_path,
          ndjsonText: ndjsonText,
          windowNumber: currentWindowNumber,
          windowStartTime: windowStartTime,
          windowEndTime: windowEndTime
        });

        emitAndSaveResult(
          'foul_candidate',
          currentWindowNumber,
          'completed',
          result
        );

        return result;
      } catch (err) {
        emitAndSaveResult(
          'foul_candidate',
          currentWindowNumber,
          'failed',
          null,
          err.message
        );

        console.warn(
          '[Foul] GPU clip window ' + currentWindowNumber + ' failed:',
          err.message
        );

        return null;
      }
    };

    const getWindowTimeBounds = (packetsToSend) => {
      const timestamps = [];

      for (const line of packetsToSend) {
        try {
          const packet = typeof line === 'string' ? JSON.parse(line) : line;
          const timestamp = Number(packet?.timestamp_sec ?? packet?.timestamp);

          if (Number.isFinite(timestamp)) {
            timestamps.push(timestamp);
          }
        } catch {
          // Ignore non-JSON lines. Vision packets are normally valid JSON.
        }
      }

      if (timestamps.length === 0) {
        return {
          startTime: null,
          endTime: null
        };
      }

      return {
        startTime: Math.min(...timestamps),
        endTime: Math.max(...timestamps)
      };
    };

    const sendModelWindow = (packetsToSend) => {
      if (!packetsToSend || packetsToSend.length === 0) {
        return;
      }

      windowNumber++;

      const currentWindowNumber = windowNumber;
      const ndjsonText = packetsToSend.join('\n') + '\n';
      const timeBounds = getWindowTimeBounds(packetsToSend);

      console.log(
        '[Orchestrator] Sending live window ' +
          currentWindowNumber +
          ' with packets: ' +
          packetsToSend.length
      );

      liveEventService.emitMatchStatus(matchId, {
        status: 'processing',
        message: 'Sending live model window ' + currentWindowNumber,
        packets_count: packetsCount,
        window_number: currentWindowNumber
      });

      modelTasks.push(
        modelWindowLimiter(() =>
          runModelWindow(
            'tactical',
            tacticalClientService,
            ndjsonText,
            currentWindowNumber
          )
        )
      );

      modelTasks.push(
        modelWindowLimiter(() =>
          runModelWindow(
            'xg',
            xgClientService,
            ndjsonText,
            currentWindowNumber
          )
        )
      );

      modelTasks.push(
        modelWindowLimiter(() =>
          runModelWindow(
            'offside',
            offsideClientService,
            ndjsonText,
            currentWindowNumber
          )
        )
      );

      // Foul clips are processed sequentially to avoid flooding the GPU service.
      const foulTask = foulTaskChain.then(() =>
        runFoulClipWindow(
          ndjsonText,
          currentWindowNumber,
          timeBounds.startTime,
          timeBounds.endTime
        )
      );

      foulTaskChain = foulTask.catch(() => null);
      modelTasks.push(foulTask);
    };

    const visionResult = await visionClientService.processVideo(
      matchInfo.video_path,
      async (packet) => {
        packetsCount++;

        windowPackets.push(JSON.stringify(packet));

        if (windowPackets.length >= WINDOW_SIZE) {
          const packetsToSend = windowPackets;
          windowPackets = [];

          sendModelWindow(packetsToSend);
        }

        const now = Date.now();

        if (now - lastProgressUpdate > 3000) {
          const progress = Math.min(95, 10 + Math.floor(packetsCount / 50));

          await jobService.updateJobProgress(
            matchId,
            progress,
            'Live Vision + Tactical + xG + Offside + Foul... packets: ' +
              packetsCount +
              ', windows: ' +
              windowNumber
          );

          liveEventService.emitMatchStatus(matchId, {
            status: 'processing',
            progress: progress,
            message: 'Live processing',
            packets_count: packetsCount,
            windows_count: windowNumber
          });

          lastProgressUpdate = now;
        }
      }
    );

    if (windowPackets.length > 0) {
      const finalPackets = windowPackets;
      windowPackets = [];

      sendModelWindow(finalPackets);
    }

    await jobService.updateJobProgress(
      matchId,
      96,
      'Vision finished. Waiting for all model windows...'
    );

    liveEventService.emitMatchStatus(matchId, {
      status: 'processing',
      progress: 96,
      message: 'Vision finished. Waiting for all model windows...',
      packets_count: packetsCount,
      windows_count: windowNumber
    });

    await Promise.allSettled(modelTasks);

    await jobService.updateJobProgress(
      matchId,
      98,
      'Vision + Tactical + xG + Offside + Foul finished. Packets: ' +
        packetsCount +
        ', windows: ' +
        windowNumber
    );

    await jobService.completeJob(matchId);

    liveEventService.emitMatchStatus(matchId, {
      status: 'completed',
      progress: 100,
      message: 'All live AI models completed',
      packets_count: packetsCount,
      windows_count: windowNumber,
      vision_result: visionResult
    });

    console.log(
      '[Orchestrator] Vision + Tactical + xG + Offside + Foul completed for match ' +
        matchId
    );

    return {
      status: 'completed',
      match_id: matchId,
      packets_count: packetsCount,
      windows_count: windowNumber,
      vision_result: visionResult
    };
  }
}

const orchestratorService = new OrchestratorService();
export default orchestratorService;
