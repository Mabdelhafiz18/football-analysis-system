import postgresPool from '../connection.js';
import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../../../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seedPostgres = async () => {
    console.log('Seeding PostgreSQL data from JSON files...');
    const client = await postgresPool.connect();
    const dataDir = config.paths.dataDir;

    try {
        await client.query('BEGIN');

        // 1. Load Matches
        const matchesData = JSON.parse(await fs.readFile(join(dataDir, 'matches.json'), 'utf-8'));
        for (const match of matchesData) {
            await client.query(
                `INSERT INTO matches (id, home_team, away_team, date, league, status) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (id) DO UPDATE SET 
         home_team = EXCLUDED.home_team, away_team = EXCLUDED.away_team, 
         date = EXCLUDED.date, league = EXCLUDED.league, status = EXCLUDED.status`,
                [match.id, match.home_team, match.away_team, match.date, match.league, match.status]
            );

            const matchId = match.id;

            // 2. Load Offsides
            const offsidesPath = join(dataDir, `match_${matchId}_offsides.json`);
            try {
                const offsides = JSON.parse(await fs.readFile(offsidesPath, 'utf-8'));
                for (const o of offsides) {
                    await client.query(
                        `INSERT INTO offsides (match_id, incident_id, minute, second, timestamp, frame_number, team, player_number, position_x, position_y, decision, margin_meters, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (match_id, incident_id) DO NOTHING`,
                        [matchId, o.incident_id, o.minute, o.second, o.timestamp, o.frame_number, o.team, o.player_number, o.position_x, o.position_y, o.decision, o.margin_meters, o.confidence]
                    );
                }
            } catch (e) { console.log(`No offsides for match ${matchId}`); }

            // 3. Load Fouls
            const foulsPath = join(dataDir, `match_${matchId}_fouls.json`);
            try {
                const fouls = JSON.parse(await fs.readFile(foulsPath, 'utf-8'));
                for (const f of fouls) {
                    await client.query(
                        `INSERT INTO fouls (match_id, foul_id, minute, second, timestamp, frame_number, team, player_number, position_x, position_y, foul_type, severity, card_type, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (match_id, foul_id) DO NOTHING`,
                        [matchId, f.foul_id, f.minute, f.second, f.timestamp, f.frame_number, f.team, f.player_number, f.position_x, f.position_y, f.foul_type, f.severity, f.card_type, f.confidence]
                    );
                }
            } catch (e) { console.log(`No fouls for match ${matchId}`); }

            // 4. Load Shots
            const shotsPath = join(dataDir, `match_${matchId}_shots.json`);
            try {
                const shots = JSON.parse(await fs.readFile(shotsPath, 'utf-8'));
                for (const s of shots) {
                    await client.query(
                        `INSERT INTO shots (match_id, shot_id, minute, second, timestamp, team, player_number, x, y, xg, outcome, is_on_target, is_goal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (match_id, shot_id) DO NOTHING`,
                        [matchId, s.shot_id, s.minute, s.second, s.timestamp, s.team, s.player_number, s.x, s.y, s.xg, s.outcome, s.is_on_target, s.is_goal]
                    );
                }
            } catch (e) { console.log(`No shots for match ${matchId}`); }

            // 5. Load Summary
            const summaryPath = join(dataDir, `match_${matchId}_summary.json`);
            try {
                const s = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
                await client.query(
                    `INSERT INTO match_summaries (match_id, home_score, away_score, possession_home, possession_away, shots_home, shots_away, fouls_home, fouls_away, offsides_home, offsides_away)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (match_id) DO UPDATE SET home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score`,
                    [matchId, s.goals.home, s.goals.away, s.possession.home, s.possession.away, s.shots.home, s.shots.away, s.fouls.home, s.fouls.away, s.offsides.home, s.offsides.away]
                );
            } catch (e) { console.log(`No summary for match ${matchId}`); }
        }

        await client.query('COMMIT');
        console.log('PostgreSQL seeding completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', err.message);
    } finally {
        client.release();
        process.exit();
    }
};

seedPostgres();
