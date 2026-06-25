import fs from 'fs/promises';
import path from 'path';
import postgresPool from '../database/postgres/connection.js';
import config from '../config/config.js';

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

class AnalysisDataService {
  async getMatchAnalysis(matchId) {
    const id = Number.parseInt(matchId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error('Invalid match id');
      error.status = 400;
      throw error;
    }

    const [matchResult, jobResult, windowsResult] = await Promise.all([
      postgresPool.query('SELECT * FROM matches WHERE id = $1 LIMIT 1', [id]),
      postgresPool.query(
        `SELECT * FROM processing_jobs WHERE match_id = $1 ORDER BY id DESC LIMIT 1`,
        [id]
      ),
      postgresPool.query(
        `SELECT *
         FROM model_window_results
         WHERE match_id = $1
         ORDER BY window_number ASC, id ASC`,
        [id]
      )
    ]);

    if (!matchResult.rows.length) {
      const error = new Error('Match not found');
      error.status = 404;
      throw error;
    }

    const match = matchResult.rows[0];
    const job = jobResult.rows[0] || null;
    const windows = windowsResult.rows.map((row) => ({
      ...row,
      window_number: Number(row.window_number),
      result: row.result ?? null,
      error: row.error ?? null
    }));

    const modelCounts = windows.reduce((acc, row) => {
      const key = row.model_name || 'unknown';
      if (!acc[key]) acc[key] = { total: 0, completed: 0, failed: 0, processing: 0 };
      acc[key].total += 1;
      if (row.status === 'completed') acc[key].completed += 1;
      else if (row.status === 'failed') acc[key].failed += 1;
      else acc[key].processing += 1;
      return acc;
    }, {});

    return {
      match,
      job,
      windows,
      model_counts: modelCounts,
      media: {
        video_url: `/api/analysis/matches/${id}/video`
      }
    };
  }

  async getModelWindows(matchId, modelName) {
    const id = Number.parseInt(matchId, 10);
    const values = [id];
    let where = 'WHERE match_id = $1';

    if (modelName) {
      values.push(String(modelName));
      where += ' AND model_name = $2';
    }

    const result = await postgresPool.query(
      `SELECT *
       FROM model_window_results
       ${where}
       ORDER BY window_number ASC, id ASC`,
      values
    );

    return result.rows;
  }

  async resolveVideo(matchId) {
    const id = Number.parseInt(matchId, 10);
    const result = await postgresPool.query(
      `SELECT id, video_url, video_filename FROM matches WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!result.rows.length) {
      const error = new Error('Match not found');
      error.status = 404;
      throw error;
    }

    const row = result.rows[0];
    if (isHttpUrl(row.video_url)) {
      return { type: 'remote', url: row.video_url };
    }

    const candidates = [];
    if (typeof row.video_url === 'string' && row.video_url.trim()) {
      candidates.push(path.resolve(row.video_url));
    }
    if (typeof row.video_filename === 'string' && row.video_filename.trim()) {
      candidates.push(path.join(config.paths.uploadsDir, path.basename(row.video_filename)));
    }

    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return { type: 'local', path: candidate };
      } catch {
        // Try next candidate.
      }
    }

    const error = new Error('Video file is not available for this match');
    error.status = 404;
    throw error;
  }
}

export default new AnalysisDataService();
