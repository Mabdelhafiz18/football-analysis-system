import express from 'express';
import {
    getMatches,
    getMatchSummary,
    getMatchStatus,
    getMatchEvents,
    getTrackingData,
    getTrackingRange
} from '../controllers/matchController.js';

const router = express.Router();

// List all matches
router.get('/', getMatches);

// Match status (for polling during processing)
router.get('/:matchId/status', getMatchStatus);

// Match summary statistics
router.get('/:matchId/summary', getMatchSummary);

// Match events (offsides, fouls, shots)
router.get('/:matchId/events', getMatchEvents);

// Tracking data by timestamp
router.get('/:matchId/tracking', getTrackingData);

// Tracking data for time range
router.get('/:matchId/tracking/range', getTrackingRange);

export default router;
