import databaseService from '../services/databaseService.js';
import fs from 'fs/promises';
import { join } from 'path';
import config from '../config/config.js';

export const getTacticalData = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    const tacticalData = await databaseService._readJsonFile(`match_${matchId}_tactical.json`);
    if (!tacticalData) {
      return res.status(404).json({ error: 'Tactical data not found' });
    }
    res.json(tacticalData);
  } catch (err) {
    next(err);
  }
};

export const getPassNetwork = async (req, res, next) => {
  try {
    const { match_id } = req.query;
    
    // If match_id provided, return pass network for that specific match
    if (match_id) {
      const tacticalData = await databaseService._readJsonFile(`match_${match_id}_tactical.json`);
      if (!tacticalData || !tacticalData.pass_network) {
        return res.status(404).json({ error: 'Pass network data not found for this match' });
      }
      
      // Combine home and away passes for the frontend format
      const allPasses = [
        ...(tacticalData.pass_network.home || []),
        ...(tacticalData.pass_network.away || [])
      ];
      
      return res.json({
        match_id: parseInt(match_id),
        passes: allPasses,
        home: tacticalData.pass_network.home || [],
        away: tacticalData.pass_network.away || []
      });
    }
    
    // If no match_id, return aggregated pass network from all matches
    const matches = await databaseService.getMatches() || [];
    const completedMatches = matches.filter(m => m.status === 'completed');
    
    let allPasses = [];
    
    for (const match of completedMatches) {
      const tacticalData = await databaseService._readJsonFile(`match_${match.id}_tactical.json`);
      if (tacticalData && tacticalData.pass_network) {
        allPasses.push(...(tacticalData.pass_network.home || []));
        allPasses.push(...(tacticalData.pass_network.away || []));
      }
    }
    
    // Aggregate passes between same players across matches
    const passMap = new Map();
    for (const pass of allPasses) {
      const key = `${pass.from}-${pass.to}`;
      if (passMap.has(key)) {
        passMap.get(key).count += pass.count;
      } else {
        passMap.set(key, { ...pass });
      }
    }
    
    res.json({
      passes: Array.from(passMap.values())
    });
  } catch (err) {
    next(err);
  }
};

