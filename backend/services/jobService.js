import config from '../config/config.js';
import postgresPool from '../database/postgres/connection.js';

/**
 * Job Service for tracking video processing status
 * Uses in-memory storage with optional PostgreSQL persistence
 * - In-memory: Fast access for active jobs
 * - PostgreSQL: Persistence across restarts (when enabled)
 */
class JobService {
  constructor() {
    // In-memory storage for jobs
    this.jobs = new Map();
    // Counter for generating match IDs
    this.matchIdCounter = 100;
    // Use PostgreSQL for persistence if enabled
    this.usePostgres = config.db.postgres.enabled;
    // Flag to control simulation (disabled when AI service is available)
    this.simulationEnabled = false;
  }

  /**
   * Initialize the service - load existing jobs from database
   */
  async initialize() {
    if (this.usePostgres) {
      try {
        // Load active jobs from database
        const result = await postgresPool.query(
          `SELECT * FROM processing_jobs WHERE status IN ('processing', 'pending') ORDER BY created_at DESC`
        );
        
        for (const row of result.rows) {
          this.jobs.set(row.match_id, this._rowToJob(row));
          // Update counter to avoid ID conflicts
          if (row.match_id > this.matchIdCounter) {
            this.matchIdCounter = row.match_id;
          }
        }
        
        console.log(`[JobService] Loaded ${result.rows.length} active jobs from database`);
      } catch (err) {
        console.warn('[JobService] Could not load jobs from database:', err.message);
      }
    }
  }

  /**
   * Convert database row to job object
   * @param {Object} row - Database row
   * @returns {Object} Job object
   */
  _rowToJob(row) {
    return {
      job_id: row.job_id,
      ai_job_id: row.ai_job_id,
      match_id: row.match_id,
      status: row.status,
      progress: row.progress || 0,
      message: row.message || '',
      created_at: row.created_at?.toISOString(),
      started_at: row.started_at?.toISOString(),
      processed_at: row.processed_at?.toISOString(),
      error: row.error,
      match_info: row.match_info,
      video_filename: row.video_filename
    };
  }

  /**
   * Creates a new processing job
   * @param {Object} matchInfo - Match information
   * @returns {Object} Job details with match_id
   */
  async createJob(matchInfo) {
    const matchId = ++this.matchIdCounter;
    const jobId = `job-${Date.now()}-${matchId}`;
    
    const job = {
      job_id: jobId,
      ai_job_id: null, // Will be set when AI service responds
      match_id: matchId,
      status: 'processing',
      progress: 0,
      message: 'Video upload complete. Sending to AI service...',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      match_info: matchInfo,
      video_filename: matchInfo.video_filename || null
    };

    this.jobs.set(matchId, job);
    
    // Persist to database
    await this._persistJob(job);
    
    // Only simulate if explicitly enabled (for development without AI service)
    if (this.simulationEnabled) {
      this._simulateProgress(matchId);
    }

    return job;
  }

  /**
   * Persist job to database
   * @param {Object} job - Job object
   */
  async _persistJob(job) {
    if (!this.usePostgres) return;

    try {
      await postgresPool.query(
        `INSERT INTO processing_jobs (
          match_id, job_id, ai_job_id, status, progress, message,
          created_at, started_at, video_filename, match_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (match_id) DO UPDATE SET
          job_id = EXCLUDED.job_id,
          ai_job_id = EXCLUDED.ai_job_id,
          status = EXCLUDED.status,
          progress = EXCLUDED.progress,
          message = EXCLUDED.message,
          started_at = EXCLUDED.started_at,
          video_filename = EXCLUDED.video_filename,
          match_info = EXCLUDED.match_info`,
        [
          job.match_id,
          job.job_id,
          job.ai_job_id,
          job.status,
          job.progress,
          job.message,
          job.created_at,
          job.started_at,
          job.video_filename,
          JSON.stringify(job.match_info)
        ]
      );
    } catch (err) {
      console.warn('[JobService] Failed to persist job:', err.message);
    }
  }

  /**
   * Update job in database
   * @param {Object} job - Job object
   */
  async _updateJobInDb(job) {
    if (!this.usePostgres) return;

    try {
      await postgresPool.query(
        `UPDATE processing_jobs SET
          ai_job_id = $2,
          status = $3,
          progress = $4,
          message = $5,
          processed_at = $6,
          error = $7
        WHERE match_id = $1`,
        [
          job.match_id,
          job.ai_job_id,
          job.status,
          job.progress,
          job.message,
          job.processed_at || null,
          job.error || null
        ]
      );
    } catch (err) {
      console.warn('[JobService] Failed to update job in database:', err.message);
    }
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

    // For existing demo matches (1, 2, etc.), return completed status
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
   * Get job by AI job ID
   * @param {string} aiJobId - AI service job ID
   * @returns {Object|null} Job or null
   */
  getJobByAIJobId(aiJobId) {
    for (const job of this.jobs.values()) {
      if (job.ai_job_id === aiJobId) {
        return job;
      }
    }
    return null;
  }

  /**
   * Set the AI service job ID for a match
   * @param {number|string} matchId 
   * @param {string} aiJobId - Job ID from AI service
   */
  async setAIJobId(matchId, aiJobId) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.ai_job_id = aiJobId;
      job.message = 'Processing started by AI service...';
      await this._updateJobInDb(job);
    }
  }

  /**
   * Updates job progress
   * @param {number|string} matchId 
   * @param {number} progress 
   * @param {string} message 
   */
  async updateJobProgress(matchId, progress, message) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.progress = progress;
      job.message = message || job.message;
      await this._updateJobInDb(job);
    }
  }

  /**
   * Marks job as completed
   * @param {number|string} matchId 
   */
  async completeJob(matchId) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Processing complete';
      job.processed_at = new Date().toISOString();
      await this._updateJobInDb(job);
      
      console.log(`[JobService] Job completed for match ${matchId}`);
    }
  }

  /**
   * Marks job as failed
   * @param {number|string} matchId 
   * @param {string} error 
   */
  async failJob(matchId, error) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);
    
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.message = `Processing failed: ${error}`;
      await this._updateJobInDb(job);
      
      console.log(`[JobService] Job failed for match ${matchId}: ${error}`);
    }
  }

  /**
   * Enable simulation mode (for development without AI service)
   */
  enableSimulation() {
    this.simulationEnabled = true;
    console.log('[JobService] Simulation mode enabled');
  }

  /**
   * Disable simulation mode (use AI service)
   */
  disableSimulation() {
    this.simulationEnabled = false;
    console.log('[JobService] Simulation mode disabled');
  }

  /**
   * Check if simulation is enabled
   * @returns {boolean}
   */
  isSimulationEnabled() {
    return this.simulationEnabled;
  }

  /**
   * Get all active jobs
   * @returns {Array} Array of active jobs
   */
  getActiveJobs() {
    return Array.from(this.jobs.values()).filter(
      job => job.status === 'processing' || job.status === 'pending'
    );
  }

  /**
   * Get job count
   * @returns {Object} Count of jobs by status
   */
  getJobCounts() {
    const counts = { processing: 0, pending: 0, completed: 0, failed: 0 };
    for (const job of this.jobs.values()) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }
    return counts;
  }

  /**
   * Simulates processing progress for development/demo purposes
   * Only used when simulationEnabled is true
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

    const interval = setInterval(async () => {
      if (stageIndex >= stages.length) {
        await this.completeJob(matchId);
        clearInterval(interval);
        return;
      }

      const stage = stages[stageIndex];
      await this.updateJobProgress(matchId, stage.progress, stage.message);
      stageIndex++;
    }, 3000); // Update every 3 seconds for demo
  }
}

// Export singleton instance
const jobService = new JobService();
export default jobService;
