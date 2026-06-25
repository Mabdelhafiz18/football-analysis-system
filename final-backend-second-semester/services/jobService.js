import config from '../config/config.js';
import postgresPool from '../database/postgres/connection.js';

class JobService {
  constructor() {
    this.jobs = new Map();
    this.matchIdCounter = 100;
    this.usePostgres = config.db.postgres.enabled;
    this.simulationEnabled = false;
  }

  async initialize() {
    if (this.usePostgres) {
      try {
        const result = await postgresPool.query(
          'SELECT * FROM processing_jobs WHERE status IN (\'processing\', \'pending\') ORDER BY created_at DESC'
        );

        for (const row of result.rows) {
          this.jobs.set(row.match_id, this._rowToJob(row));

          if (row.match_id > this.matchIdCounter) {
            this.matchIdCounter = row.match_id;
          }
        }

        console.log('[JobService] Loaded ' + result.rows.length + ' active jobs from database');
      } catch (err) {
        console.warn('[JobService] Could not load jobs from database:', err.message);
      }
    }
  }

  _rowToJob(row) {
    return {
      job_id: row.job_id,
      ai_job_id: row.ai_job_id,
      match_id: row.match_id,
      status: row.status,
      progress: row.progress || 0,
      message: row.message || '',
      created_at: row.created_at ? row.created_at.toISOString() : null,
      started_at: row.started_at ? row.started_at.toISOString() : null,
      processed_at: row.processed_at ? row.processed_at.toISOString() : null,
      error: row.error,
      match_info: row.match_info,
      video_filename: row.video_filename
    };
  }

  async createJob(matchInfo) {
    const matchId = matchInfo.match_id
      ? parseInt(matchInfo.match_id, 10)
      : ++this.matchIdCounter;

    const jobId = 'job-' + Date.now() + '-' + matchId;

    const job = {
      job_id: jobId,
      ai_job_id: null,
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

    await this._persistJob(job);

    if (this.simulationEnabled) {
      this._simulateProgress(matchId);
    }

    return job;
  }

  async _persistJob(job) {
    if (!this.usePostgres) return;

    try {
      await postgresPool.query(
        'INSERT INTO processing_jobs (' +
          'match_id, job_id, ai_job_id, status, progress, message, ' +
          'created_at, started_at, video_filename, match_info' +
        ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ' +
        'ON CONFLICT (match_id) DO UPDATE SET ' +
          'job_id = EXCLUDED.job_id, ' +
          'ai_job_id = EXCLUDED.ai_job_id, ' +
          'status = EXCLUDED.status, ' +
          'progress = EXCLUDED.progress, ' +
          'message = EXCLUDED.message, ' +
          'started_at = EXCLUDED.started_at, ' +
          'video_filename = EXCLUDED.video_filename, ' +
          'match_info = EXCLUDED.match_info',
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

      await postgresPool.query(
        'UPDATE matches ' +
        'SET job_id = $1, status = $2, processing_status = $3, updated_at = NOW() ' +
        'WHERE id = $4',
        [
          job.job_id,
          job.status,
          job.status,
          job.match_id
        ]
      );
    } catch (err) {
      console.warn('[JobService] Failed to persist job:', err.message);
    }
  }

  async _updateJobInDb(job) {
    if (!this.usePostgres) return;

    try {
      await postgresPool.query(
        'UPDATE processing_jobs SET ' +
          'ai_job_id = $2, ' +
          'status = $3, ' +
          'progress = $4, ' +
          'message = $5, ' +
          'processed_at = $6, ' +
          'error = $7 ' +
        'WHERE match_id = $1',
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

      await postgresPool.query(
        'UPDATE matches ' +
        'SET status = $1, ' +
            'processing_status = $2, ' +
            'processing_completed_at = $3, ' +
            'error_message = $4, ' +
            'updated_at = NOW() ' +
        'WHERE id = $5',
        [
          job.status,
          job.status,
          job.status === 'completed' ? job.processed_at || new Date().toISOString() : null,
          job.error || null,
          job.match_id
        ]
      );
    } catch (err) {
      console.warn('[JobService] Failed to update job in database:', err.message);
    }
  }

  getJob(matchId) {
    const id = parseInt(matchId, 10);

    if (this.jobs.has(id)) {
      return this.jobs.get(id);
    }

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

  getJobByAIJobId(aiJobId) {
    for (const job of this.jobs.values()) {
      if (job.ai_job_id === aiJobId) {
        return job;
      }
    }

    return null;
  }

  async setAIJobId(matchId, aiJobId) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);

    if (job) {
      job.ai_job_id = aiJobId;
      job.message = 'Processing started by AI service...';
      await this._updateJobInDb(job);
    }
  }

  async updateJobProgress(matchId, progress, message) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);

    if (job) {
      job.progress = progress;
      job.message = message || job.message;
      await this._updateJobInDb(job);
    }
  }

  async completeJob(matchId) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);

    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Processing complete';
      job.processed_at = new Date().toISOString();

      await this._updateJobInDb(job);

      console.log('[JobService] Job completed for match ' + matchId);
    }
  }

  async failJob(matchId, error) {
    const id = parseInt(matchId, 10);
    const job = this.jobs.get(id);

    if (job) {
      job.status = 'failed';
      job.error = error;
      job.message = 'Processing failed: ' + error;

      await this._updateJobInDb(job);

      console.log('[JobService] Job failed for match ' + matchId + ': ' + error);
    }
  }

  enableSimulation() {
    this.simulationEnabled = true;
    console.log('[JobService] Simulation mode enabled');
  }

  disableSimulation() {
    this.simulationEnabled = false;
    console.log('[JobService] Simulation mode disabled');
  }

  isSimulationEnabled() {
    return this.simulationEnabled;
  }

  getActiveJobs() {
    return Array.from(this.jobs.values()).filter(
      job => job.status === 'processing' || job.status === 'pending'
    );
  }

  getJobCounts() {
    const counts = {
      processing: 0,
      pending: 0,
      completed: 0,
      failed: 0
    };

    for (const job of this.jobs.values()) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }

    return counts;
  }

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
    }, 3000);
  }
}

const jobService = new JobService();
export default jobService;