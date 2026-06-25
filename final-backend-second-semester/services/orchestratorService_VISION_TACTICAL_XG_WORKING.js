import visionClientService from './visionClientService.js';
import tacticalClientService from './tacticalClientService.js';
import xgClientService from './xgClientService.js';
import jobService from './jobService.js';

class OrchestratorService {
  startProcessing(matchInfo) {
    const matchId = parseInt(matchInfo.match_id, 10);

    console.log('[Orchestrator] Starting live Vision + Tactical + xG for match ' + matchId);

    this._runVisionTacticalXg(matchId, matchInfo).catch(async (err) => {
      console.error('[Orchestrator] Processing failed:', err.message);
      console.error(err.stack);
      await jobService.failJob(matchId, err.message);
    });

    return {
      status: 'started',
      match_id: matchId
    };
  }

  async _runVisionTacticalXg(matchId, matchInfo) {
    if (!matchInfo.video_path) {
      throw new Error('Video path is missing');
    }

    await jobService.updateJobProgress(
      matchId,
      5,
      'Starting Vision + Tactical + xG live pipeline...'
    );

    let packetsCount = 0;
    let windowNumber = 0;
    let windowPackets = [];
    let lastProgressUpdate = Date.now();

    const modelTasks = [];
    const WINDOW_SIZE = 50;

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

      const tacticalTask = tacticalClientService
        .analyzeWindow(matchId, ndjsonText, currentWindowNumber)
        .then((result) => {
          console.log('[Orchestrator] Tactical window ' + currentWindowNumber + ' completed');
          return result;
        })
        .catch((err) => {
          console.warn('[Tactical] Window ' + currentWindowNumber + ' failed:', err.message);
          return null;
        });

      const xgTask = xgClientService
        .analyzeWindow(matchId, ndjsonText, currentWindowNumber)
        .then((result) => {
          console.log('[Orchestrator] xG window ' + currentWindowNumber + ' completed');
          return result;
        })
        .catch((err) => {
          console.warn('[xG] Window ' + currentWindowNumber + ' failed:', err.message);
          return null;
        });

      modelTasks.push(tacticalTask);
      modelTasks.push(xgTask);
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
            'Live Vision + Tactical + xG... packets: ' + packetsCount + ', windows: ' + windowNumber
          );

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
      'Vision finished. Waiting for Tactical and xG windows...'
    );

    await Promise.allSettled(modelTasks);

    await jobService.updateJobProgress(
      matchId,
      98,
      'Vision + Tactical + xG finished. Packets: ' + packetsCount + ', windows: ' + windowNumber
    );

    await jobService.completeJob(matchId);

    console.log('[Orchestrator] Vision + Tactical + xG completed for match ' + matchId);

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