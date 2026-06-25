import pool from '../database/postgres/connection.js';

class ModelResultService {
  async saveWindowResult(matchId, modelName, windowNumber, result) {
    try {
      await pool.query(
        `
        INSERT INTO model_window_results
          (match_id, model_name, window_number, status, result, error, updated_at)
        VALUES
          ($1, $2, $3, $4, $5::jsonb, NULL, NOW())
        ON CONFLICT (match_id, model_name, window_number)
        DO UPDATE SET
          status = EXCLUDED.status,
          result = EXCLUDED.result,
          error = NULL,
          updated_at = NOW()
        `,
        [
          matchId,
          modelName,
          windowNumber,
          'completed',
          JSON.stringify(result || {})
        ]
      );

      console.log(
        '[DB] Saved ' +
          modelName +
          ' window ' +
          windowNumber +
          ' result for match ' +
          matchId
      );
    } catch (err) {
      console.warn('[DB] Failed to save ' + modelName + ' result:', err.message);
    }
  }

  async saveWindowError(matchId, modelName, windowNumber, errorMessage) {
    try {
      await pool.query(
        `
        INSERT INTO model_window_results
          (match_id, model_name, window_number, status, result, error, updated_at)
        VALUES
          ($1, $2, $3, $4, NULL, $5, NOW())
        ON CONFLICT (match_id, model_name, window_number)
        DO UPDATE SET
          status = EXCLUDED.status,
          result = NULL,
          error = EXCLUDED.error,
          updated_at = NOW()
        `,
        [
          matchId,
          modelName,
          windowNumber,
          'failed',
          errorMessage
        ]
      );

      console.log(
        '[DB] Saved ' +
          modelName +
          ' window ' +
          windowNumber +
          ' error for match ' +
          matchId
      );
    } catch (err) {
      console.warn('[DB] Failed to save ' + modelName + ' error:', err.message);
    }
  }
}

const modelResultService = new ModelResultService();
export default modelResultService;