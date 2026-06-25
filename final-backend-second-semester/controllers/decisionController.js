import databaseService from '../services/databaseService.js';

export const getOffsides = async (req, res, next) => {
  try {
    const { match_id } = req.query;
    const matchId = match_id || 1;
    const offsides = await databaseService._readJsonFile(`match_${matchId}_offsides.json`);
    res.json(offsides || []);
  } catch (err) {
    next(err);
  }
};

export const getFouls = async (req, res, next) => {
  try {
    const { match_id } = req.query;
    const matchId = match_id || 1;
    const fouls = await databaseService._readJsonFile(`match_${matchId}_fouls.json`);
    res.json(fouls || []);
  } catch (err) {
    next(err);
  }
};

export const getGoalPredictions = async (req, res, next) => {
  try {
    const { match_id } = req.query;
    if (!match_id) return res.status(400).json({ error: 'match_id is required' });
    const shots = await databaseService._readJsonFile(`match_${match_id}_shots.json`);
    res.json(shots || []);
  } catch (err) {
    next(err);
  }
};

