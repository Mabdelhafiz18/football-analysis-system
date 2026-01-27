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
    this.cache = new Map();
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

    // Always generate from events to ensure consistency with AI models data
    const summary = await this.generateSummaryFromEvents(matchId);
    if (summary) return summary;

    // Fallback to static summary file only if generation fails
    return this._readJsonFile(`match_${matchId}_summary.json`);
  }

  /**
   * Generate match summary from events data
   * @param {number|string} matchId 
   */
  async generateSummaryFromEvents(matchId) {
    // Get events from database or JSON
    const events = await this.getMatchEvents(matchId);
    const offsides = events.offsides;
    const fouls = events.fouls;
    const shots = events.shots;

    // Get matches list and tactical data
    const [matches, tactical] = await Promise.all([
      this.getMatches(),
      this._readJsonFile(`match_${matchId}_tactical.json`)
    ]);

    // Find match info
    const matchInfo = (matches || []).find(m => String(m.id) === String(matchId)) || {};

    // Calculate offsides per team
    const offsideHome = (offsides || []).filter(o => o.team === 'home').length;
    const offsideAway = (offsides || []).filter(o => o.team === 'away').length;

    // Calculate fouls and cards per team
    const foulsArray = fouls || [];
    const foulHome = foulsArray.filter(f => f.team === 'home').length;
    const foulAway = foulsArray.filter(f => f.team === 'away').length;
    const yellowHome = foulsArray.filter(f => f.team === 'home' && f.card_type === 'yellow').length;
    const yellowAway = foulsArray.filter(f => f.team === 'away' && f.card_type === 'yellow').length;
    const redHome = foulsArray.filter(f => f.team === 'home' && f.card_type === 'red').length;
    const redAway = foulsArray.filter(f => f.team === 'away' && f.card_type === 'red').length;

    // Calculate shots, shots on target, and goals
    const shotsArray = shots || [];
    const shotsHome = shotsArray.filter(s => s.team === 'home').length;
    const shotsAway = shotsArray.filter(s => s.team === 'away').length;
    const shotsOnTargetHome = shotsArray.filter(s => s.team === 'home' && (s.is_on_target === true || s.outcome === 'goal' || s.outcome === 'saved')).length;
    const shotsOnTargetAway = shotsArray.filter(s => s.team === 'away' && (s.is_on_target === true || s.outcome === 'goal' || s.outcome === 'saved')).length;
    const goalsHome = shotsArray.filter(s => s.team === 'home' && (s.outcome === 'goal' || s.is_goal === true)).length;
    const goalsAway = shotsArray.filter(s => s.team === 'away' && (s.outcome === 'goal' || s.is_goal === true)).length;
    const xgHome = shotsArray.filter(s => s.team === 'home').reduce((sum, s) => sum + (s.xg || 0), 0);
    const xgAway = shotsArray.filter(s => s.team === 'away').reduce((sum, s) => sum + (s.xg || 0), 0);

    // Get possession from tactical data if available
    let possessionHome = 50;
    let possessionAway = 50;
    if (tactical && tactical.possession_timeline) {
      const timeline = tactical.possession_timeline;
      if (timeline.home && timeline.home.length > 0) {
        possessionHome = Math.round(timeline.home.reduce((a, b) => a + b, 0) / timeline.home.length);
        possessionAway = 100 - possessionHome;
      }
    }

    if (!matchInfo.id && !offsides && !fouls && !shots) return null;

    return {
      match_id: parseInt(matchId),
      home_team: matchInfo.home_team || 'Home Team',
      away_team: matchInfo.away_team || 'Away Team',
      date: matchInfo.date || new Date().toISOString(),
      league: matchInfo.league || 'Unknown League',
      venue: matchInfo.venue || 'Unknown Venue',
      possession: {
        home: possessionHome,
        away: possessionAway
      },
      shots: {
        home: shotsHome,
        away: shotsAway
      },
      shots_on_target: {
        home: shotsOnTargetHome,
        away: shotsOnTargetAway
      },
      goals: {
        home: goalsHome,
        away: goalsAway
      },
      xg: {
        home: Math.round(xgHome * 100) / 100,
        away: Math.round(xgAway * 100) / 100
      },
      fouls: {
        home: foulHome,
        away: foulAway
      },
      offsides: {
        home: offsideHome,
        away: offsideAway
      },
      cards: {
        yellow_home: yellowHome,
        yellow_away: yellowAway,
        red_home: redHome,
        red_away: redAway
      }
    };
  }

  // Helper to read JSON file with caching
  async _readJsonFile(filename) {
    // Only cache large tracking files, skip cache for match data and tactical data
    const shouldCache = filename.includes('tracking');

    // Return cached data if available
    if (shouldCache && this.cache.has(filename)) {
      return this.cache.get(filename);
    }

    try {
      const filePath = join(config.paths.dataDir, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Cache the result if applicable
      if (shouldCache) {
        this.cache.set(filename, parsed);
      }

      return parsed;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Get all events for a match with optional filtering
   * @param {number|string} matchId 
   * @param {Object} filters - { type: 'offside'|'foul'|'shot', team: 'home'|'away' }
   */
  async getMatchEvents(matchId, filters = {}) {
    let offsides = null;
    let fouls = null;
    let shots = null;

    // Try PostgreSQL first
    if (this.usePostgres) {
      try {
        const [offsidesResult, foulsResult, shotsResult] = await Promise.all([
          this._getOffsidesFromDb(matchId),
          this._getFoulsFromDb(matchId),
          this._getShotsFromDb(matchId)
        ]);

        if (offsidesResult.length > 0 || foulsResult.length > 0 || shotsResult.length > 0) {
          offsides = offsidesResult;
          fouls = foulsResult;
          shots = shotsResult;
        }
      } catch (err) {
        console.warn('PostgreSQL error fetching events, falling back to JSON:', err.message);
      }
    }

    // Fallback to JSON files
    if (offsides === null) {
      [offsides, fouls, shots] = await Promise.all([
        this._readJsonFile(`match_${matchId}_offsides.json`),
        this._readJsonFile(`match_${matchId}_fouls.json`),
        this._readJsonFile(`match_${matchId}_shots.json`)
      ]);
    }

    let result = {
      offsides: offsides || [],
      fouls: fouls || [],
      shots: shots || []
    };

    // Filter by type if specified
    if (filters.type) {
      const typeMap = {
        'offside': 'offsides',
        'foul': 'fouls',
        'shot': 'shots'
      };
      const key = typeMap[filters.type];
      if (key) {
        result = { [key]: result[key] };
      }
    }

    // Filter by team if specified
    if (filters.team) {
      for (const key of Object.keys(result)) {
        result[key] = result[key].filter(event => event.team === filters.team);
      }
    }

    return result;
  }

  /**
   * Get offsides from PostgreSQL
   * @param {number|string} matchId
   * @returns {Promise<Array>}
   */
  async _getOffsidesFromDb(matchId) {
    const result = await postgresPool.query(
      `SELECT 
        incident_id, minute, second, timestamp, frame_number,
        team, player_number, player_name,
        position_x, position_y, decision, margin_meters, confidence,
        attacker_position_x, attacker_position_y,
        defender_position_x, defender_position_y
      FROM offsides 
      WHERE match_id = $1 
      ORDER BY timestamp`,
      [matchId]
    );

    return result.rows.map(row => ({
      incident_id: row.incident_id,
      minute: row.minute,
      second: parseFloat(row.second),
      timestamp: parseFloat(row.timestamp),
      frame_number: row.frame_number,
      team: row.team,
      player_number: row.player_number,
      player_name: row.player_name,
      position_x: parseFloat(row.position_x),
      position_y: parseFloat(row.position_y),
      decision: row.decision,
      margin_meters: parseFloat(row.margin_meters),
      confidence: parseFloat(row.confidence),
      attacker_position: {
        x: parseFloat(row.attacker_position_x),
        y: parseFloat(row.attacker_position_y)
      },
      defender_position: {
        x: parseFloat(row.defender_position_x),
        y: parseFloat(row.defender_position_y)
      }
    }));
  }

  /**
   * Get fouls from PostgreSQL
   * @param {number|string} matchId
   * @returns {Promise<Array>}
   */
  async _getFoulsFromDb(matchId) {
    const result = await postgresPool.query(
      `SELECT 
        foul_id, minute, second, timestamp, frame_number,
        team, player_number, player_name,
        position_x, position_y, foul_type, severity, card_type, confidence,
        contact_point_x, contact_point_y
      FROM fouls 
      WHERE match_id = $1 
      ORDER BY timestamp`,
      [matchId]
    );

    return result.rows.map(row => ({
      foul_id: row.foul_id,
      minute: row.minute,
      second: parseFloat(row.second),
      timestamp: parseFloat(row.timestamp),
      frame_number: row.frame_number,
      team: row.team,
      player_number: row.player_number,
      player_name: row.player_name,
      position_x: parseFloat(row.position_x),
      position_y: parseFloat(row.position_y),
      foul_type: row.foul_type,
      severity: row.severity,
      card_type: row.card_type,
      confidence: parseFloat(row.confidence),
      contact_point: {
        x: parseFloat(row.contact_point_x),
        y: parseFloat(row.contact_point_y)
      }
    }));
  }

  /**
   * Get shots from PostgreSQL
   * @param {number|string} matchId
   * @returns {Promise<Array>}
   */
  async _getShotsFromDb(matchId) {
    const result = await postgresPool.query(
      `SELECT 
        shot_id, minute, second, timestamp, frame_number,
        team, player_number, player_name,
        x, y, target_x, target_y,
        is_goal, is_on_target, goal_probability, xg
      FROM shots 
      WHERE match_id = $1 
      ORDER BY timestamp`,
      [matchId]
    );

    return result.rows.map(row => ({
      shot_id: row.shot_id,
      minute: row.minute,
      second: parseFloat(row.second),
      timestamp: parseFloat(row.timestamp),
      frame_number: row.frame_number,
      team: row.team,
      player_number: row.player_number,
      player_name: row.player_name,
      position_x: parseFloat(row.x),
      position_y: parseFloat(row.y),
      target_x: row.target_x ? parseFloat(row.target_x) : null,
      target_y: row.target_y ? parseFloat(row.target_y) : null,
      is_goal: row.is_goal,
      is_on_target: row.is_on_target,
      goal_probability: row.goal_probability ? parseFloat(row.goal_probability) : null,
      xg: row.xg ? parseFloat(row.xg) : null
    }));
  }

  /**
   * Get tracking frame by timestamp
   * @param {number|string} matchId 
   * @param {number} timestamp - Timestamp in seconds
   */
  /**
   * Normalize a tracking frame to consistent format for frontend
   * Ensures both `t` and `timestamp` fields exist, cleans up MongoDB _id fields
   */
  _normalizeTrackingFrame(frame) {
    if (!frame) return null;
    
    const obj = frame.toObject ? frame.toObject() : { ...frame };
    
    // Normalize timestamp fields - ensure both t and timestamp exist
    const time = obj.t !== undefined ? obj.t : obj.timestamp;
    const frameNum = obj.frame !== undefined ? obj.frame : obj.frame_number;
    
    // Clean up players array - remove MongoDB _id fields
    const players = (obj.players || []).map(p => {
      const { _id, ...player } = p;
      return {
        player_id: player.player_id,
        team: player.team,
        x: player.x,
        y: player.y,
        bbox: player.bbox || null,
        speed: player.speed,
        number: player.number
      };
    });
    
    // Clean up ball object
    const ball = obj.ball ? {
      x: obj.ball.x,
      y: obj.ball.y,
      z: obj.ball.z,
      speed: obj.ball.speed
    } : null;
    
    return {
      t: time,
      timestamp: time,
      frame: frameNum,
      frame_number: frameNum,
      players,
      ball
    };
  }

  async getTrackingFrame(matchId, timestamp) {
    if (this.useMongodb) {
      try {
        const Tracking = (await import('../database/mongodb/models/Tracking.js')).default;

        // Find closest frame: look for exactly matching timestamp, or closest one
        // Since we can't easily do "abs(diff)" in query, we look for range [t-0.5, t+0.5]
        const frame = await Tracking.findOne({
          match_id: matchId,
          timestamp: { $gte: timestamp - 0.2, $lte: timestamp + 0.2 }
        }).sort({ timestamp: 1 }); // Heuristic: just take the first in small window

        if (frame) {
          const normalized = this._normalizeTrackingFrame(frame);
          return {
            ...normalized,
            fps: 25,
            pitch: { length_m: 105, width_m: 68 }
          };
        }
      } catch (err) {
        console.warn('MongoDB error fetching tracking frame:', err.message);
      }
    }

    // Fallback to JSON
    const tracking = await this._readJsonFile(`match_${matchId}_tracking.json`);
    if (!tracking || !tracking.frames) return null;

    // Find the closest frame to the requested timestamp
    const frames = tracking.frames;
    let closestFrame = frames[0];
    let minDiff = Math.abs((frames[0].t || frames[0].timestamp || 0) - timestamp);

    for (const frame of frames) {
      const frameTime = frame.t !== undefined ? frame.t : frame.timestamp;
      if (frameTime === undefined) continue;

      const diff = Math.abs(frameTime - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    return {
      ...this._normalizeTrackingFrame(closestFrame),
      fps: tracking.fps,
      pitch: tracking.pitch
    };
  }

  /**
   * Get tracking frames for a time range
   * @param {number|string} matchId 
   * @param {number} startTime - Start timestamp in seconds
   * @param {number} endTime - End timestamp in seconds
   */
  async getTrackingRange(matchId, startTime, endTime) {
    if (this.useMongodb) {
      try {
        const Tracking = (await import('../database/mongodb/models/Tracking.js')).default;

        const frames = await Tracking.find({
          match_id: matchId,
          timestamp: { $gte: startTime, $lte: endTime }
        }).sort({ timestamp: 1 }).limit(2000); // Safety limit

        if (frames.length > 0) {
          return {
            fps: 25,
            pitch: { length_m: 105, width_m: 68 },
            frames: frames.map(f => this._normalizeTrackingFrame(f)),
            total_frames: frames.length
          };
        }
      } catch (err) {
        console.warn('MongoDB error fetching tracking range:', err.message);
      }
    }

    // Fallback to JSON
    const tracking = await this._readJsonFile(`match_${matchId}_tracking.json`);
    if (!tracking || !tracking.frames) return null;

    const frames = tracking.frames.filter(frame => {
      const frameTime = frame.t !== undefined ? frame.t : frame.timestamp;
      return frameTime !== undefined && frameTime >= startTime && frameTime <= endTime;
    });

    return {
      fps: tracking.fps,
      pitch: tracking.pitch,
      frames: frames.map(f => this._normalizeTrackingFrame(f)),
      total_frames: frames.length
    };
  }

  /**
   * Get aggregated analytics across all matches
   * @returns {Object} Aggregated statistics
   */
  async getAnalytics() {
    const matches = await this.getMatches() || [];

    // Initialize counters
    let totalGoals = 0;
    let totalOffsides = 0;
    let totalFouls = 0;
    let totalShots = 0;
    let totalXG = 0;
    let totalYellowCards = 0;
    let totalRedCards = 0;

    // Status breakdown
    const statusBreakdown = {
      completed: 0,
      processing: 0,
      pending: 0,
      failed: 0
    };

    // League breakdown
    const leagueBreakdown = {};

    // Process each match
    for (const match of matches) {
      // Update status breakdown
      const status = match.status || 'pending';
      if (statusBreakdown[status] !== undefined) {
        statusBreakdown[status]++;
      }

      // Update league breakdown
      const league = match.league || 'Unknown League';
      if (!leagueBreakdown[league]) {
        leagueBreakdown[league] = { total: 0, completed: 0 };
      }
      leagueBreakdown[league].total++;
      if (status === 'completed') {
        leagueBreakdown[league].completed++;
      }

      // For completed matches, aggregate events data
      if (status === 'completed') {
        try {
          // Get events for this match
          const events = await this.getMatchEvents(match.id);

          // Count offsides
          totalOffsides += (events.offsides || []).length;

          // Count fouls and cards
          const fouls = events.fouls || [];
          totalFouls += fouls.length;
          totalYellowCards += fouls.filter(f => f.card_type === 'yellow').length;
          totalRedCards += fouls.filter(f => f.card_type === 'red').length;

          // Count shots and goals
          const shots = events.shots || [];
          totalShots += shots.length;
          totalGoals += shots.filter(s => s.outcome === 'goal' || s.is_goal === true).length;
          totalXG += shots.reduce((sum, s) => sum + (s.xg || 0), 0);
        } catch (err) {
          console.warn(`Error loading events for match ${match.id}:`, err.message);
        }
      }
    }

    const completedMatches = statusBreakdown.completed;
    const avgGoalsPerMatch = completedMatches > 0 ? totalGoals / completedMatches : 0;
    const avgXG = completedMatches > 0 ? totalXG / completedMatches : 0;

    // Aggregate heatmaps from all completed matches
    const heatmapStats = await this._aggregateHeatmaps(matches.filter(m => m.status === 'completed'));

    return {
      totalMatches: matches.length,
      completedMatches,
      totalGoals,
      avgGoalsPerMatch: Math.round(avgGoalsPerMatch * 100) / 100,
      decisions: {
        total: totalOffsides + totalFouls,
        offsides: totalOffsides,
        fouls: totalFouls
      },
      shots: {
        total: totalShots,
        goals: totalGoals,
        avgXG: Math.round(avgXG * 100) / 100
      },
      cards: {
        yellow: totalYellowCards,
        red: totalRedCards
      },
      leagueBreakdown,
      statusBreakdown,
      heatmapStats
    };
  }

  /**
   * Aggregate heatmaps from multiple matches
   * @param {Array} completedMatches - Array of completed match objects
   * @returns {Object} Aggregated heatmap statistics
   */
  async _aggregateHeatmaps(completedMatches) {
    if (!completedMatches || completedMatches.length === 0) {
      return {
        totalMatches: 0,
        aggregatedHeatmap: null
      };
    }

    let gridW = 12;
    let gridH = 8;
    let homeSum = null;
    let awaySum = null;
    let matchCount = 0;

    for (const match of completedMatches) {
      try {
        const tactical = await this._readJsonFile(`match_${match.id}_tactical.json`);
        if (tactical && tactical.team_heatmap) {
          const heatmap = tactical.team_heatmap;
          gridW = heatmap.grid_w || gridW;
          gridH = heatmap.grid_h || gridH;

          // Initialize sum arrays if needed
          if (!homeSum) {
            homeSum = heatmap.home.map(row => row.map(() => 0));
            awaySum = heatmap.away.map(row => row.map(() => 0));
          }

          // Add heatmap values
          for (let i = 0; i < heatmap.home.length; i++) {
            for (let j = 0; j < heatmap.home[i].length; j++) {
              homeSum[i][j] += heatmap.home[i][j];
              awaySum[i][j] += heatmap.away[i][j];
            }
          }
          matchCount++;
        }
      } catch (err) {
        console.warn(`Error loading tactical data for match ${match.id}:`, err.message);
      }
    }

    // Calculate averages
    if (matchCount > 0 && homeSum && awaySum) {
      const homeAvg = homeSum.map(row => row.map(val => Math.round(val / matchCount * 100) / 100));
      const awayAvg = awaySum.map(row => row.map(val => Math.round(val / matchCount * 100) / 100));

      return {
        totalMatches: matchCount,
        aggregatedHeatmap: {
          grid_w: gridW,
          grid_h: gridH,
          home: homeAvg,
          away: awayAvg
        }
      };
    }

    return {
      totalMatches: 0,
      aggregatedHeatmap: null
    };
  }

  /**
   * Create a new match record
   * @param {Object} matchInfo - Match information
   */
  async createMatch(matchInfo) {
    if (this.usePostgres) {
      try {
        const result = await postgresPool.query(
          `INSERT INTO matches (home_team, away_team, date, league, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING *`,
          [matchInfo.homeTeam, matchInfo.awayTeam, matchInfo.date, matchInfo.league, 'processing']
        );
        return result.rows[0];
      } catch (err) {
        console.warn('PostgreSQL error creating match:', err.message);
      }
    }

    // Return mock match for JSON fallback
    return {
      id: Date.now(),
      ...matchInfo,
      status: 'processing',
      created_at: new Date().toISOString()
    };
  }
}

export default new DatabaseService();

