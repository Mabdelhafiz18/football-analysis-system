import databaseService from '../services/databaseService.js';
import jobService from '../services/jobService.js';

/**
 * GET /matches
 * Returns list of all matches
 */
export const getMatches = async (req, res, next) => {
  try {
    const matches = await databaseService.getMatches();
    res.json(matches || []);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /matches/:matchId/summary
 * Returns match summary statistics
 */
export const getMatchSummary = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const summary = await databaseService.getMatchSummary(matchId);
    if (!summary) {
      return res.status(404).json({ error: 'Match summary not found' });
    }
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /matches/:matchId/status
 * Returns match processing status (for polling)
 */
export const getMatchStatus = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const job = jobService.getJob(matchId);

    if (!job) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Match not found'
      });
    }

    res.json({
      match_id: parseInt(matchId, 10),
      status: job.status,
      progress: job.progress,
      message: job.message,
      ...(job.processed_at && { processed_at: job.processed_at }),
      ...(job.error && { error: job.error })
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /matches/:matchId/events
 * Returns all events (offsides, fouls, shots) with optional filtering
 * Query params: type (offside|foul|shot), team (home|away)
 */
export const getMatchEvents = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { type, team } = req.query;

    // Check if match exists and is completed
    const job = jobService.getJob(matchId);
    if (!job) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Match not found'
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'NotReady',
        message: 'Match processing not completed. Events will be available after processing finishes.',
        status: job.status,
        progress: job.progress
      });
    }

    const events = await databaseService.getMatchEvents(matchId, { type, team });
    res.json(events);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /matches/:matchId/tracking
 * Returns tracking data for a specific timestamp
 * Query params: timestamp (seconds)
 */
export const getTrackingData = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { timestamp } = req.query;

    if (timestamp === undefined) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'timestamp query parameter is required'
      });
    }

    const frame = await databaseService.getTrackingFrame(matchId, parseFloat(timestamp));

    if (!frame) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Tracking data not found for this match'
      });
    }

    res.json(frame);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /matches/:matchId/tracking/range
 * Returns tracking data for a time range
 * Query params: start_time, end_time (seconds)
 */
export const getTrackingRange = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { start_time, end_time } = req.query;

    if (start_time === undefined || end_time === undefined) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'start_time and end_time query parameters are required'
      });
    }

    const range = await databaseService.getTrackingRange(
      matchId,
      parseFloat(start_time),
      parseFloat(end_time)
    );

    if (!range) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Tracking data not found for this match'
      });
    }

    res.json(range);
  } catch (err) {
    next(err);
  }
};
