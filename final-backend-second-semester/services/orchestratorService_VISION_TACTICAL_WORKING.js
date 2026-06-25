import visionClientService from './visionClientService.js';
import tacticalClientService from './tacticalClientService.js';
import jobService from './jobService.js';

class OrchestratorService {
  startProcessing(matchInfo) {
    const matchId = parseInt(matchInfo.match_id, 10);

    console.log('[Orchestrator] Starting live Vision + Tactical for match ' + matchId);

    this._runVisionAndTactical(matchId, matchInfo).catch(async (err) => {
      console.error('[Orchestrator] Processing failed:', err.message);
      console.error(err.stack);
      await jobService.failJob(matchId, err.message);
    });

    return {
      status: 'started',
      match_id: matchId
    };
  }

  async _runVisionAndTactical(matchId, matchInfo) {
    if (!matchInfo.video_path) {
      throw new Error('Video path is missing');
    }

    await jobService.updateJobProgress(
      matchId,
      5,
      'Starting Vision + Tactical live pipeline...'
    );

    let packetsCount = 0;
    let windowNumber = 0;
    let windowPackets = [];
    let lastProgressUpdate = Date.now();

    const tacticalTasks = [];
    const WINDOW_SIZE = 50;

    const sendTacticalWindow = (packetsToSend) => {
      if (!packetsToSend || packetsToSend.length === 0) {
        return;
      }

      windowNumber++;

      const currentWindowNumber = windowNumber;
      const ndjsonText = packetsToSend.join('\n') + '\n';

      console.log(
        '[Orchestrator] Sending Tactical window ' +
          currentWindowNumber +
          ' with packets: ' +
          packetsToSend.length
      );

      const task = tacticalClientService
        .analyzeWindow(matchId, ndjsonText, currentWindowNumber)
        .then((result) => {
          console.log('[Orchestrator] Tactical window ' + currentWindowNumber + ' completed');
          return result;
        })
        .catch((err) => {
          console.warn('[Tactical] Window ' + currentWindowNumber + ' failed:', err.message);
          return null;
        });

      tacticalTasks.push(task);
    };

    const visionResult = await visionClientService.processVideo(
      matchInfo.video_path,
      async (packet) => {
        packetsCount++;

        windowPackets.push(JSON.stringify(packet));

        if (windowPackets.length >= WINDOW_SIZE) {
          const packetsToSend = windowPackets;
          windowPackets = [];

          sendTacticalWindow(packetsToSend);
        }

        const now = Date.now();

        if (now - lastProgressUpdate > 3000) {
          const progress = Math.min(95, 10 + Math.floor(packetsCount / 50));

          await jobService.updateJobProgress(
            matchId,
            progress,
            'Live Vision + Tactical... packets: ' + packetsCount + ', tactical windows: ' + windowNumber
          );

          lastProgressUpdate = now;
        }
      }
    );

    if (windowPackets.length > 0) {
      const finalPackets = windowPackets;
      windowPackets = [];

      sendTacticalWindow(finalPackets);
    }

    await jobService.updateJobProgress(
      matchId,
      96,
      'Vision finished. Waiting for Tactical windows...'
    );

    await Promise.allSettled(tacticalTasks);

    await jobService.updateJobProgress(
      matchId,
      98,
      'Vision + Tactical finished. Packets: ' + packetsCount + ', windows: ' + windowNumber
    );

    await jobService.completeJob(matchId);

    console.log('[Orchestrator] Vision + Tactical completed for match ' + matchId);

    return {
      status: 'completed',
      match_id: matchId,
      packets_count: packetsCount,
      tactical_windows: windowNumber,
      vision_result: visionResult
    };
  }
}

const orchestratorService = new OrchestratorService();
export default orchestratorService;