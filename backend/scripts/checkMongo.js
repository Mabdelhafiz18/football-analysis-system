import mongoose from 'mongoose';
import config from '../config/config.js';
import Tracking from '../database/mongodb/models/Tracking.js';
import Tactical from '../database/mongodb/models/Tactical.js';

/**
 * MongoDB Database Check Script
 */
async function checkMongo() {
  console.log('📦 Checking MongoDB...');
  
  if (!config.db.mongodb.enabled) {
    console.log('   ⏭️  MongoDB is disabled in config (USE_MONGODB=false)');
    return;
  }

  try {
    const uri = config.db.mongodb.uri || 'mongodb://localhost:27017';
    const dbName = config.db.mongodb.dbName || 'vision_pitch_ai';

    console.log(`   URI: ${uri}`);
    console.log(`   Database: ${dbName}`);

    await mongoose.connect(uri, {
      dbName: dbName
    });

    console.log('   ✅ MongoDB Connected Successfully');

    // Check collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`   📊 Collections found: ${collections.length}`);
    collections.forEach(col => {
      console.log(`      - ${col.name}`);
    });

    // Check Tracking data
    try {
      const trackingCount = await Tracking.countDocuments({});
      console.log(`   📈 Tracking documents: ${trackingCount}`);

      if (trackingCount > 0) {
        const matchIds = await Tracking.distinct('match_id');
        console.log(`   🎯 Matches with tracking data: ${matchIds.length}`);
        for (const matchId of matchIds) {
          const count = await Tracking.countDocuments({ match_id: matchId });
          const first = await Tracking.findOne({ match_id: matchId }).sort({ timestamp: 1 });
          const last = await Tracking.findOne({ match_id: matchId }).sort({ timestamp: -1 });
          console.log(`      Match ${matchId}: ${count} frames (${first?.timestamp}s - ${last?.timestamp}s)`);
        }
      }
    } catch (err) {
      console.log(`   ⚠️  Error checking Tracking: ${err.message}`);
    }

    // Check Tactical data
    try {
      const tacticalCount = await Tactical.countDocuments({});
      console.log(`   📊 Tactical documents: ${tacticalCount}`);
    } catch (err) {
      console.log(`   ⚠️  Error checking Tactical: ${err.message}`);
    }

    await mongoose.disconnect();
    console.log('   ✅ MongoDB Check Complete\n');

  } catch (err) {
    console.log(`   ❌ MongoDB Connection Failed: ${err.message}\n`);
    process.exit(1);
  }
}

checkMongo();





