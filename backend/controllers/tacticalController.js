import databaseService from '../services/databaseService.js';
import fs from 'fs/promises';
import { join } from 'path';
import config from '../config/config.js';

export const getTacticalData = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    // For now using fallback to JSON via databaseService would be better
    // but I'll implement a direct read or extend databaseService
    const tacticalData = await databaseService._readJsonFile(`match_${matchId}_tactical.json`);
    if (!tacticalData) {
      return res.status(404).json({ error: 'Tactical data not found' });
    }
    res.json(tacticalData);
  } catch (err) {
    next(err);
  }
};

export const getHeatmap = async (req, res, next) => {
  try {
    // Mock or read aggregate heatmap
    res.json([
      { x: 20, y: 50, intensity: 0.7 },
      { x: 60, y: 45, intensity: 0.9 },
      { x: 75, y: 35, intensity: 0.8 },
    ]);
  } catch (err) {
    next(err);
  }
};

export const getPassNetwork = async (req, res, next) => {
  try {
    res.json({
      passes: [
        { from: 8, to: 10, count: 12 },
        { from: 4, to: 6, count: 15 },
      ]
    });
  } catch (err) {
    next(err);
  }
};

