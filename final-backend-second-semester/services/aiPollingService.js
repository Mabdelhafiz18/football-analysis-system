import config from '../config/config.js';
import aiClientService from './aiClientService.js';
import jobService from './jobService.js';

/**
 * AI Polling Service
 * Manages the polling lifecycle for video processing jobs
 * - Sends videos to AI service
 * - Polls for status updates
 * - Stores results when completed
 * - Handles errors and timeouts
 */
class AIPollingService {
  constructor() {
    this.pollingInterval = config.ai.pollingInterval;
    this.maxPollingTime = config.ai.processingTimeout || 30 * 60 * 1000; // 30 minutes max polling time
    this.activePolls = new Map(); // jobId -> polling state
    this.resultStorageService = null; // Lazy loaded to avoid circular dependencies
  }

  /**
   * Get the result storage service (lazy load)
   */
  async getResultStorageService() {
    if (!this.resultStorageService) {
      const module = await import('./resultStorageService.js');
      this.resultStorageService = module.default;
    }
    return this.resultStorageService;
  }

  /**
   * Start processing a video
   * Sends the video to AI service and begins polling
   * @param {number} matchId - Match ID
   * @param {Object} matchInfo - Match information including video URL
   * @returns {Promise<{job_id: string, status: string}>}
   */
  async startProcessing(matchId, matchInfo) {
    console.log(`[AIPoller] Starting processing for match ${matchId}`);

    // Prepare the payload per API contract
    const payload = {
      match_id: matchId,
      video_url: matchInfo.video_url,
      video_filename: matchInfo.video_filename,
      match_info: {
        home_team: matchInfo.homeTeam,
        away_team: matchInfo.awayTeam,
        date: matchInfo.date,
        league: matchInfo.league || null
      }
    };

    try {
      // Send to AI service
      const response = await aiClientService.processVideo(payload);
      
      const jobId = response.job_id;
      
      // Update job service with AI job_id
      jobService.setAIJobId(matchId, jobId);

      // Start polling in background
      this.startPolling(matchId, jobId);

      return {
        job_id: jobId,
        status: response.status || 'processing'
      };
    } catch (error) {
      console.error(`[AIPoller] Failed to start processing for match ${matchId}:`, error.message);
      
      // Mark job as failed
      jobService.failJob(matchId, `AI service error: ${error.message}`);
      
      throw error;
    }
  }

  /**
   * Start polling for a job
   * @param {number} matchId - Match ID
   * @param {string} jobId - AI service job ID
   */
  startPolling(matchId, jobId) {
    if (this.activePolls.has(jobId)) {
      console.warn(`[AIPoller] Polling already active for job ${jobId}`);
      return;
    }

    const startTime = Date.now();
    const pollState = {
      matchId,
      jobId,
      startTime,
      intervalId: null,
      stopped: false
    };

    this.activePolls.set(jobId, pollState);

    console.log(`[AIPoller] Starting polling for job ${jobId} (match ${matchId})`);

    // Start polling
    pollState.intervalId = setInterval(async () => {
      await this.poll(pollState);
    }, this.pollingInterval);

    // Also do an immediate poll
    this.poll(pollState);
  }

  /**
   * Perform a single poll
   * @param {Object} pollState - Polling state object
   */
  async poll(pollState) {
    const { matchId, jobId, startTime, stopped } = pollState;

    if (stopped) return;

    // Check for timeout
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > this.maxPollingTime) {
      console.error(`[AIPoller] Polling timeout for job ${jobId} after ${elapsedTime}ms`);
      this.stopPolling(jobId);
      jobService.failJob(matchId, 'Processing timeout');
      return;
    }

    try {
      const status = await aiClientService.getStatus(jobId);
      
      console.log(`[AIPoller] Status for job ${jobId}: ${status.status} (${status.progress || 0}%)`);

      // Update job progress
      if (status.progress !== undefined) {
        jobService.updateJobProgress(matchId, status.progress, status.message);
      }

      // Handle completion
      if (status.status === 'completed') {
        console.log(`[AIPoller] Job ${jobId} completed!`);
        this.stopPolling(jobId);
        await this.handleCompletion(matchId, status);
      }

      // Handle failure
      if (status.status === 'failed') {
        console.error(`[AIPoller] Job ${jobId} failed:`, status.error || status.message);
        this.stopPolling(jobId);
        jobService.failJob(matchId, status.error || status.message || 'Processing failed');
      }

    } catch (error) {
      console.error(`[AIPoller] Error polling job ${jobId}:`, error.message);
      
      // Don't stop polling on transient errors, just log them
      // The AI client has retry logic built in
    }
  }

  /**
   * Handle successful completion
   * Store results in database
   * @param {number} matchId - Match ID
   * @param {Object} statusResponse - Status response with results
   */
  async handleCompletion(matchId, statusResponse) {
    const results = statusResponse.results;

    if (!results) {
      console.warn(`[AIPoller] Job completed but no results provided for match ${matchId}`);
      jobService.completeJob(matchId);
      return;
    }

    try {
      // Get result storage service
      const resultStorage = await this.getResultStorageService();

      // Store all results
      await resultStorage.storeResults(matchId, results);

      console.log(`[AIPoller] Results stored successfully for match ${matchId}`);

      // Mark job as completed
      jobService.completeJob(matchId);

    } catch (error) {
      console.error(`[AIPoller] Failed to store results for match ${matchId}:`, error.message);
      // Still mark as completed since AI processing succeeded
      // The results might be partially stored
      jobService.completeJob(matchId);
    }
  }

  /**
   * Stop polling for a job
   * @param {string} jobId - AI service job ID
   */
  stopPolling(jobId) {
    const pollState = this.activePolls.get(jobId);
    if (pollState) {
      pollState.stopped = true;
      if (pollState.intervalId) {
        clearInterval(pollState.intervalId);
      }
      this.activePolls.delete(jobId);
      console.log(`[AIPoller] Stopped polling for job ${jobId}`);
    }
  }

  /**
   * Stop all active polling
   */
  stopAll() {
    console.log(`[AIPoller] Stopping all polling (${this.activePolls.size} active jobs)`);
    for (const jobId of this.activePolls.keys()) {
      this.stopPolling(jobId);
    }
  }

  /**
   * Get the number of active polling jobs
   * @returns {number}
   */
  getActiveJobCount() {
    return this.activePolls.size;
  }

  /**
   * Check if a job is being polled
   * @param {string} jobId - AI service job ID
   * @returns {boolean}
   */
  isPolling(jobId) {
    return this.activePolls.has(jobId);
  }

  /**
   * Check if AI service is available
   * @returns {Promise<boolean>}
   */
  async isAIServiceAvailable() {
    return aiClientService.isAvailable();
  }
}

// Export singleton instance
const aiPollingService = new AIPollingService();
export default aiPollingService;
