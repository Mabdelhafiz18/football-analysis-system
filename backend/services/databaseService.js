import fs from 'fs/promises';
import { join } from 'path';
import config from '../config/config.js';
import postgresPool from '../database/postgres/connection.js';
import mongoose from 'mongoose';

/**
 * Abstraction layer for database access with fallback to JSON files
 */
class DatabaseService {
  constructor() {
    this.usePostgres = config.db.postgres.enabled;
    this.useMongodb = config.db.mongodb.enabled;
  }

  async getMatches() {
    if (this.usePostgres) {
      try {
        const result = await postgresPool.query('SELECT * FROM matches ORDER BY date DESC');
        return result.rows;
      } catch (err) {
        console.warn('PostgreSQL error, falling back to JSON:', err.message);
      }
    }
    
    return this._readJsonFile('matches.json');
  }

  async getMatchSummary(matchId) {
    if (this.usePostgres) {
      try {
        const result = await postgresPool.query('SELECT * FROM match_summaries WHERE match_id = $1', [matchId]);
        if (result.rows.length > 0) return result.rows[0];
      } catch (err) {
        console.warn('PostgreSQL error, falling back to JSON:', err.message);
      }
    }

    return this._readJsonFile(`match_${matchId}_summary.json`);
  }

  async _readJsonFile(filename) {
    try {
      const filePath = join(config.paths.dataDir, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
}

export default new DatabaseService();

