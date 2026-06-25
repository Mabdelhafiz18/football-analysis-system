import mongoose from 'mongoose';
import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import connectMongoDB from '../connection.js';
import Tracking from '../models/Tracking.js';
import Tactical from '../models/Tactical.js';
import config from '../../../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seedData = async () => {
  console.log('Seeding MongoDB data...');

  // Force enable MongoDB for seeding script
  config.db.mongodb.enabled = true;
  await connectMongoDB();

  try {
    const dataDir = config.paths.dataDir; // Should resolve to d:\NU\graduation project\data
    const matchesData = JSON.parse(await fs.readFile(join(dataDir, 'matches.json'), 'utf-8'));

    for (const match of matchesData) {
      const matchId = match.id;
      console.log(`Processing Match ${matchId}...`);

      // 1. Seed Tactical Data
      const tacticalPath = join(dataDir, `match_${matchId}_tactical.json`);
      try {
        const tacticalData = JSON.parse(await fs.readFile(tacticalPath, 'utf-8'));

        await Tactical.findOneAndUpdate(
          { match_id: matchId },
          { ...tacticalData, match_id: matchId },
          { upsert: true, new: true }
        );
        console.log(`- Tactical data seeded for Match ${matchId}.`);
      } catch (err) {
        // console.warn(`Skipping tactical data for Match ${matchId}: ${err.message}`);
      }

      // 2. Seed Tracking Data
      const trackingPath = join(dataDir, `match_${matchId}_tracking.json`);
      try {
        console.log(`- Reading Tracking Data for Match ${matchId} (Large File)...`);
        const trackingData = JSON.parse(await fs.readFile(trackingPath, 'utf-8'));

        // Clear existing tracking for this match
        await Tracking.deleteMany({ match_id: matchId });

        if (trackingData.frames && Array.isArray(trackingData.frames)) {
          const totalFrames = trackingData.frames.length;
          const batchSize = 500;
          console.log(`- Total frames to seed: ${totalFrames}. Processing in batches...`);

          for (let i = 0; i < totalFrames; i += batchSize) {
            const batch = trackingData.frames.slice(i, i + batchSize).map(frame => {
              // Get timestamp from either field (JSON uses 't', normalize to both)
              const time = frame.t !== undefined ? frame.t : frame.timestamp;
              const frameNum = frame.frame !== undefined ? frame.frame : frame.frame_number;
              
              // Preserve all player fields including bbox
              const players = (frame.players || []).map(p => ({
                player_id: p.player_id,
                team: p.team,
                x: p.x,
                y: p.y,
                speed: p.speed,
                number: p.number,
                direction: p.direction,
                bbox: p.bbox || null // Preserve bounding box for video overlay
              }));
              
              // Preserve complete ball object
              const ball = frame.ball ? {
                x: frame.ball.x,
                y: frame.ball.y,
                z: frame.ball.z,
                speed: frame.ball.speed
              } : {};
              
              return {
                match_id: matchId,
                timestamp: time, // Primary field for querying
                t: time, // Alias for frontend compatibility
                frame_number: frameNum, // Primary field
                frame: frameNum, // Alias for frontend compatibility
                players,
                ball
              };
            });

            await Tracking.insertMany(batch);
            if ((i + batchSize) % 2000 === 0 || (i + batchSize) >= totalFrames) {
              console.log(`  - Progress: ${Math.min(i + batchSize, totalFrames)}/${totalFrames} frames...`);
            }
          }
          console.log(`- Tracking data seeded for Match ${matchId}.`);
        }
      } catch (err) {
        console.warn(`- Failed to seed tracking for Match ${matchId}: ${err.message}`);
      }
    }

    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
};

seedData();

