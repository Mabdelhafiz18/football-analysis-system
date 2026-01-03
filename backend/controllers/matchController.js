import databaseService from '../services/databaseService.js';

export const getMatches = async (req, res, next) => {
  try {
    const matches = await databaseService.getMatches();
    res.json(matches || []);
  } catch (err) {
    next(err);
  }
};

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

