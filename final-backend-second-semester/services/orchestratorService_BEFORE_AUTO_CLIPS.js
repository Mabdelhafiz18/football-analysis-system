import visionClientService from './visionClientService.js';
import tacticalClientService from './tacticalClientService.js';
import xgClientService from './xgClientService.js';
import offsideClientService from './offsideClientService.js';
import foulClientService from './foulClientService.js';
import jobService from './jobService.js';
import modelResultService from './modelResultService.js';
import liveEventService from './liveEventService.js';

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

    const modelTasks = [];
    const WINDOW_SIZE = 50;

    const runModelWindow = async (modelName, clientService, matchId, ndjsonText, currentWindowNumber) => {
      try {
        const result = await clientService.analyzeWindow(
          matchId,
          ndjsonText,
          currentWindowNumber
        );

        // 1) Send live to frontend immediately
        liveEventService.emitModelResult(matchId, {
          model_name: modelName,
          window_number: currentWindowNumber,
          status: 'completed',
          result: result,
          timestamp: new Date().toISOString()
        });

        console.log('[Live] Emitted ' + modelName + ' window ' + currentWindowNumber + ' to frontend');

        // 2) Save to DB in background without slowing live
        modelResultService
          .saveWindowResult(matchId, modelName, currentWindowNumber, result)
          .catch((dbErr) => {
            console.warn('[DB] Background save failed for ' + modelName + ':', dbErr.message);
          });

        return result;
      } catch (err) {
        // Send error live to frontend immediately
        liveEventService.emitModelResult(matchId, {
          model_name: modelName,
          window_number: currentWindowNumber,
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString()
        });

        // Save error to DB in background
        modelResultService
          .saveWindowError(matchId, modelName, currentWindowNumber, err.message)
          .catch((dbErr) => {
            console.warn('[DB] Background error save failed for ' + modelName + ':', dbErr.message);
          });

        console.warn('[' + modelName + '] Window ' + currentWindowNumber + ' failed:', err.message);

        return null;
      }
    };

    const sendModelWindow = (packetsToSend) => {
      if (!packetsToSend || packetsToSend.length === 0) {
        return;
      }

      windowNumber++;

      const currentWindowNumber = windowNumber;
      const ndjsonText = packetsToSend.join('\n') + '\n';

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
        runModelWindow('tactical', tacticalClientService, matchId, ndjsonText, currentWindowNumber)
      );

      modelTasks.push(
        runModelWindow('xg', xgClientService, matchId, ndjsonText, currentWindowNumber)
      );

      modelTasks.push(
        runModelWindow('offside', offsideClientService, matchId, ndjsonText, currentWindowNumber)
      );

      modelTasks.push(
        runModelWindow('foul_candidate', foulClientService, matchId, ndjsonText, currentWindowNumber)
      );
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
            'Live Vision + Tactical + xG + Offside + Foul... packets: ' + packetsCount + ', windows: ' + windowNumber
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
      'Vision + Tactical + xG + Offside + Foul finished. Packets: ' + packetsCount + ', windows: ' + windowNumber
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

    console.log('[Orchestrator] Vision + Tactical + xG + Offside + Foul completed for match ' + matchId);

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