import { writeFile } from 'fs/promises';
import { join } from 'path';
import config from '../config/config.js';
import postgresPool from '../database/postgres/connection.js';
import Tracking from '../database/mongodb/models/Tracking.js';
import Tactical from '../database/mongodb/models/Tactical.js';

/**
 * Result Storage Service
 * Stores AI processing results in the appropriate database
 * - PostgreSQL: Structured event data (offsides, fouls, shots, summaries)
 * - MongoDB: Large tracking data (frames, tactical analysis)
 * - JSON files: Fallback for development
 */
class ResultStorageService {
  constructor() {
    this.usePostgres = config.db.postgres.enabled;
    this.useMongodb = config.db.mongodb.enabled;
  }

  /**
   * Store all results from AI processing
   * @param {number} matchId - Match ID
   * @param {Object} results - Results object from AI service
   */
  async storeResults(matchId, results) {
    console.log(`[ResultStorage] Storing results for match ${matchId}`);

    const storagePromises = [];

    // Store summary
    if (results.summary) {
      storagePromises.push(
        this.storeSummary(matchId, results.summary)
          .catch(err => console.error('[ResultStorage] Failed to store summary:', err.message))
      );
    }

    // Store offsides
    if (results.offsides && results.offsides.length > 0) {
      storagePromises.push(
        this.storeOffsides(matchId, results.offsides)
          .catch(err => console.error('[ResultStorage] Failed to store offsides:', err.message))
      );
    }

    // Store fouls
    if (results.fouls && results.fouls.length > 0) {
      storagePromises.push(
        this.storeFouls(matchId, results.fouls)
          .catch(err => console.error('[ResultStorage] Failed to store fouls:', err.message))
      );
    }

    // Store shots
    if (results.shots && results.shots.length > 0) {
      storagePromises.push(
        this.storeShots(matchId, results.shots)
          .catch(err => console.error('[ResultStorage] Failed to store shots:', err.message))
      );
    }

    // Store tracking data (MongoDB or JSON)
    if (results.tracking) {
      storagePromises.push(
        this.storeTracking(matchId, results.tracking)
          .catch(err => console.error('[ResultStorage] Failed to store tracking:', err.message))
      );
    }

    // Store tactical data (MongoDB or JSON)
    if (results.tactical) {
      storagePromises.push(
        this.storeTactical(matchId, results.tactical)
          .catch(err => console.error('[ResultStorage] Failed to store tactical:', err.message))
      );
    }

    // Wait for all storage operations
    await Promise.all(storagePromises);

    console.log(`[ResultStorage] All results stored for match ${matchId}`);
  }

  /**
   * Store match summary
   * @param {number} matchId
   * @param {Object} summary
   */
  async storeSummary(matchId, summary) {
    if (this.usePostgres) {
      try {
        await postgresPool.query(
          `INSERT INTO match_summaries (
            match_id, home_score, away_score,
            possession_home, possession_away,
            shots_home, shots_away,
            shots_on_target_home, shots_on_target_away,
            corners_home, corners_away,
            fouls_home, fouls_away,
            offsides_home, offsides_away,
            yellow_home, yellow_away,
            red_home, red_away
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (match_id) DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            possession_home = EXCLUDED.possession_home,
            possession_away = EXCLUDED.possession_away,
            shots_home = EXCLUDED.shots_home,
            shots_away = EXCLUDED.shots_away,
            shots_on_target_home = EXCLUDED.shots_on_target_home,
            shots_on_target_away = EXCLUDED.shots_on_target_away,
            corners_home = EXCLUDED.corners_home,
            corners_away = EXCLUDED.corners_away,
            fouls_home = EXCLUDED.fouls_home,
            fouls_away = EXCLUDED.fouls_away,
            offsides_home = EXCLUDED.offsides_home,
            offsides_away = EXCLUDED.offsides_away,
            yellow_home = EXCLUDED.yellow_home,
            yellow_away = EXCLUDED.yellow_away,
            red_home = EXCLUDED.red_home,
            red_away = EXCLUDED.red_away`,
          [
            matchId,
            summary.home_score || 0,
            summary.away_score || 0,
            summary.possession?.home || 50,
            summary.possession?.away || 50,
            summary.shots?.home || 0,
            summary.shots?.away || 0,
            summary.shots_on_target?.home || 0,
            summary.shots_on_target?.away || 0,
            summary.corners?.home || 0,
            summary.corners?.away || 0,
            summary.fouls?.home || 0,
            summary.fouls?.away || 0,
            summary.offsides?.home || 0,
            summary.offsides?.away || 0,
            summary.cards?.yellow_home || 0,
            summary.cards?.yellow_away || 0,
            summary.cards?.red_home || 0,
            summary.cards?.red_away || 0
          ]
        );
        console.log(`[ResultStorage] Summary stored in PostgreSQL for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] PostgreSQL error storing summary:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_summary.json`, summary);
  }

  /**
   * Store offside events
   * @param {number} matchId
   * @param {Array} offsides
   */
  async storeOffsides(matchId, offsides) {
    if (this.usePostgres) {
      try {
        // Delete existing offsides for this match
        await postgresPool.query('DELETE FROM offsides WHERE match_id = $1', [matchId]);

        // Insert new offsides
        for (const offside of offsides) {
          await postgresPool.query(
            `INSERT INTO offsides (
              match_id, incident_id, minute, second, timestamp, frame_number,
              team, player_number, player_name,
              position_x, position_y, decision, margin_meters, confidence,
              attacker_position_x, attacker_position_y, defender_position_x, defender_position_y
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              matchId,
              offside.incident_id,
              offside.minute,
              offside.second,
              offside.timestamp,
              offside.frame_number,
              offside.team,
              offside.player_number,
              offside.player_name,
              offside.position_x,
              offside.position_y,
              offside.decision,
              offside.margin_meters,
              offside.confidence,
              offside.attacker_position?.x,
              offside.attacker_position?.y,
              offside.defender_position?.x,
              offside.defender_position?.y
            ]
          );
        }
        console.log(`[ResultStorage] ${offsides.length} offsides stored in PostgreSQL for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] PostgreSQL error storing offsides:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_offsides.json`, offsides);
  }

  /**
   * Store foul events
   * @param {number} matchId
   * @param {Array} fouls
   */
  async storeFouls(matchId, fouls) {
    if (this.usePostgres) {
      try {
        // Delete existing fouls for this match
        await postgresPool.query('DELETE FROM fouls WHERE match_id = $1', [matchId]);

        // Insert new fouls
        for (const foul of fouls) {
          await postgresPool.query(
            `INSERT INTO fouls (
              match_id, foul_id, minute, second, timestamp, frame_number,
              team, player_number, player_name,
              position_x, position_y, foul_type, severity, card_type, confidence,
              contact_point_x, contact_point_y
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              matchId,
              foul.foul_id,
              foul.minute,
              foul.second,
              foul.timestamp,
              foul.frame_number,
              foul.team,
              foul.player_number,
              foul.player_name,
              foul.position_x,
              foul.position_y,
              foul.foul_type,
              foul.severity,
              foul.card_type,
              foul.confidence,
              foul.contact_point?.x,
              foul.contact_point?.y
            ]
          );
        }
        console.log(`[ResultStorage] ${fouls.length} fouls stored in PostgreSQL for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] PostgreSQL error storing fouls:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_fouls.json`, fouls);
  }

  /**
   * Store shot events
   * @param {number} matchId
   * @param {Array} shots
   */
  async storeShots(matchId, shots) {
    if (this.usePostgres) {
      try {
        // Delete existing shots for this match
        await postgresPool.query('DELETE FROM shots WHERE match_id = $1', [matchId]);

        // Insert new shots
        for (const shot of shots) {
          await postgresPool.query(
            `INSERT INTO shots (
              match_id, shot_id, minute, second, timestamp, frame_number,
              team, player_number, player_name,
              x, y, target_x, target_y,
              is_goal, is_on_target, goal_probability, xg
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              matchId,
              shot.shot_id,
              shot.minute,
              shot.second,
              shot.timestamp,
              shot.frame_number,
              shot.team,
              shot.player_number,
              shot.player_name,
              shot.position_x,
              shot.position_y,
              shot.target_x,
              shot.target_y,
              shot.is_goal,
              shot.is_on_target,
              shot.goal_probability,
              shot.xg
            ]
          );
        }
        console.log(`[ResultStorage] ${shots.length} shots stored in PostgreSQL for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] PostgreSQL error storing shots:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_shots.json`, shots);
  }

  /**
   * Store tracking data (frames)
   * @param {number} matchId
   * @param {Object} tracking - Tracking data with frames array
   */
  async storeTracking(matchId, tracking) {
    if (this.useMongodb && tracking.frames && tracking.frames.length > 0) {
      try {
        // Delete existing tracking data for this match
        await Tracking.deleteMany({ match_id: matchId });

        // Prepare documents for bulk insert
        const docs = tracking.frames.map(frame => ({
          match_id: matchId,
          timestamp: frame.timestamp,
          t: frame.timestamp,
          frame_number: frame.frame_number,
          frame: frame.frame_number,
          players: frame.players || [],
          ball: frame.ball || null
        }));

        // Insert in batches of 1000 for performance
        const batchSize = 1000;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          await Tracking.insertMany(batch, { ordered: false });
        }

        console.log(`[ResultStorage] ${docs.length} tracking frames stored in MongoDB for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] MongoDB error storing tracking:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_tracking.json`, tracking);
  }

  /**
   * Store tactical data
   * @param {number} matchId
   * @param {Object} tactical
   */
  async storeTactical(matchId, tactical) {
    if (this.useMongodb) {
      try {
        // Upsert tactical data
        await Tactical.findOneAndUpdate(
          { match_id: matchId },
          {
            match_id: matchId,
            formation: {
              home: tactical.formations?.home?.formation,
              away: tactical.formations?.away?.formation
            },
            team_heatmap: tactical.heatmap_data ? this.convertHeatmapData(tactical.heatmap_data) : null,
            pass_network: tactical.pass_network ? this.convertPassNetwork(tactical.pass_network) : null,
            possession_timeline: tactical.possession_timeline || null
          },
          { upsert: true, new: true }
        );

        console.log(`[ResultStorage] Tactical data stored in MongoDB for match ${matchId}`);
        return;
      } catch (err) {
        console.warn('[ResultStorage] MongoDB error storing tactical:', err.message);
      }
    }

    // Fallback to JSON
    await this.saveToJson(`match_${matchId}_tactical.json`, tactical);
  }

  /**
   * Convert heatmap data from AI format to storage format
   * @param {Array} heatmapData - Array of {x, y, intensity, team} objects
   * @returns {Object} - Gridded heatmap data
   */
  convertHeatmapData(heatmapData) {
    // Default grid size
    const gridW = 12;
    const gridH = 8;

    // Initialize grids
    const homeGrid = Array(gridH).fill(null).map(() => Array(gridW).fill(0));
    const awayGrid = Array(gridH).fill(null).map(() => Array(gridW).fill(0));

    // Populate grids from data points
    for (const point of heatmapData) {
      const gridX = Math.floor((point.x / 100) * gridW);
      const gridY = Math.floor((point.y / 100) * gridH);

      if (gridX >= 0 && gridX < gridW && gridY >= 0 && gridY < gridH) {
        if (point.team === 'home') {
          homeGrid[gridY][gridX] += point.intensity || 1;
        } else {
          awayGrid[gridY][gridX] += point.intensity || 1;
        }
      }
    }

    return {
      grid_w: gridW,
      grid_h: gridH,
      home: homeGrid,
      away: awayGrid
    };
  }

  /**
   * Convert pass network from AI format to storage format
   * @param {Array} passNetwork - Array of {from, to, count, team} objects
   * @returns {Object} - Pass network with nodes and edges
   */
  convertPassNetwork(passNetwork) {
    const nodesMap = new Map();
    const edges = [];

    for (const pass of passNetwork) {
      // Track nodes
      if (!nodesMap.has(pass.from)) {
        nodesMap.set(pass.from, { id: pass.from, team: pass.team, count: 0 });
      }
      if (!nodesMap.has(pass.to)) {
        nodesMap.set(pass.to, { id: pass.to, team: pass.team, count: 0 });
      }

      // Update counts
      nodesMap.get(pass.from).count += pass.count;
      nodesMap.get(pass.to).count += pass.count;

      // Add edge
      edges.push({
        from: pass.from,
        to: pass.to,
        count: pass.count
      });
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: edges
    };
  }

  /**
   * Save data to JSON file
   * @param {string} filename
   * @param {Object} data
   */
  async saveToJson(filename, data) {
    try {
      const filepath = join(config.paths.dataDir, filename);
      await writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`[ResultStorage] Data saved to JSON: ${filename}`);
    } catch (err) {
      console.error(`[ResultStorage] Failed to save JSON ${filename}:`, err.message);
      throw err;
    }
  }
}

// Export singleton instance
const resultStorageService = new ResultStorageService();
export default resultStorageService;
