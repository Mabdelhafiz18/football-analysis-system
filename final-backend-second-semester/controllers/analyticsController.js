import databaseService from '../services/databaseService.js';

/**
 * GET /analytics
 * Returns aggregated statistics across all matches
 */
export const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await databaseService.getAnalytics();
    res.json(analytics);
  } catch (err) {
    next(err);
  }
};

