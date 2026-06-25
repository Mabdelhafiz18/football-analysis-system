import visionClientService from './visionClientService.js';
import jobService from './jobService.js';

class OrchestratorService {
  startProcessing(matchInfo) {
    const matchId = parseInt(matchInfo.match_id, 10);

    console.log('[Orchestrator] Starting live processing for match ' + matchId);

    this._runVision(matchId, matchInfo).catch(async (err) => {
      console.error('[Orchestrator] Processing failed:', err.message);
      console.error(err.stack);
      await jobService.failJob(matchId, err.message);
    });

    return {
      status: 'started',
      match_id: matchId
    };
  }

  async _runVision(matchId, matchInfo) {
    if (!matchInfo.video_path) {
      throw new Error('Video path is missing');
    }

    await jobService.updateJobProgress(
      matchId,
      5,
      'Starting Vision live model...'
    );

    let packetsCount = 0;
    let lastProgressUpdate = Date.now();

    const result = await visionClientService.processVideo(
      matchInfo.video_path,
      async (packet) => {
        packetsCount++;

        const now = Date.now();

        if (now - lastProgressUpdate > 3000) {
          const progress = Math.min(95, 10 + Math.floor(packetsCount / 50));

          await jobService.updateJobProgress(
            matchId,
            progress,
            'Vision live processing... packets: ' + packetsCount
          );

          lastProgressUpdate = now;
        }
      }
    );

    await jobService.updateJobProgress(
      matchId,
      98,
      'Vision processing finished. Packets: ' + packetsCount
    );

    await jobService.completeJob(matchId);

    console.log('[Orchestrator] Vision completed for match ' + matchId);

    return {
      status: 'completed',
      match_id: matchId,
      packets_count: packetsCount,
      vision_result: result
    };
  }
}

const orchestratorService = new OrchestratorService();
export default orchestratorService;