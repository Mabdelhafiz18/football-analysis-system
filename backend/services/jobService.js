/**
 * In-memory job storage for tracking video processing status
 * This will be replaced with database storage when DB is ready
 */

class JobService {
  constructor() {
    // In-memory storage for jobs
    this.jobs = new Map();
    // Counter for generating match IDs
    this.matchIdCounter = 100;
  }

  /**
   * Creates a new processing job
   * @param {Object} matchInfo - Match information
   * @returns {Object} Job details with match_id
   */
  createJob(matchInfo) {
    const matchId = ++this.matchIdCounter;
    const jobId = `job-${Date.now()}-${matchId}`;
    
    const job = {
      job_id: jobId,
      match_id: matchId,
      status: 'processing',
      progress: 0,
      message: 'Video upload complete. Starting analysis...',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      match_info: matchInfo,
      video_filename: matchInfo.video_filename || null
    };

    this.jobs.set(matchId, job);
    
    // Simulate processing progress (for demo purposes)
    this._simulateProgress(matchId);

    return job;
  }

  /**
   * Gets job status by match ID
   * @param {number|string} matchId 
   * @returns {Object|null} Job status or null if not found
   */
  getJob(matchId) {
    const id = parseInt(matchId, 10);
    
    // Check in-memory jobs first
    if (this.jobs.has(id)) {
      return this.jobs.get(id);
    }

    // For existing matches (1, 2, etc.), return completed status
    if (id <= 2) {
      return {
        match_id: id,
        status: 'completed',
        progress: 100,
        message: 'Processing complete',
        processed_at: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Updates job progress
   * @param {number|string} matchId 
   * @param {number} progress 
   * @param {string} message 
   */
  updateJobProgress(matchId, progress, message) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.progress = progress;
      job.message = message || job.message;
    }
  }

  /**
   * Marks job as completed
   * @param {number|string} matchId 
   */
  completeJob(matchId) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Processing complete';
      job.processed_at = new Date().toISOString();
    }
  }

  /**
   * Marks job as failed
   * @param {number|string} matchId 
   * @param {string} error 
   */
  failJob(matchId, error) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.message = `Processing failed: ${error}`;
    }
  }

  /**
   * Simulates processing progress for demo purposes
   * In production, this would be updated by the AI service polling
   */
  _simulateProgress(matchId) {
    const stages = [
      { progress: 10, message: 'Analyzing video frames...' },
      { progress: 30, message: 'Detecting players and ball...' },
      { progress: 50, message: 'Tracking movements...' },
      { progress: 70, message: 'Analyzing events (fouls, offsides)...' },
      { progress: 90, message: 'Generating tactical analysis...' },
      { progress: 100, message: 'Processing complete' }
    ];

    let stageIndex = 0;

    const interval = setInterval(() => {
      if (stageIndex >= stages.length) {
        this.completeJob(matchId);
        clearInterval(interval);
        return;
      }

      const stage = stages[stageIndex];
      this.updateJobProgress(matchId, stage.progress, stage.message);
      stageIndex++;
    }, 3000); // Update every 3 seconds for demo
  }
}

export default new JobService();
