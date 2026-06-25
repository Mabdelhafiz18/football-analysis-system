import fs from 'fs';
import mongoose from 'mongoose';
import pg from 'pg';
import config from '../config/config.js';
import Tracking from '../database/mongodb/models/Tracking.js';
import Tactical from '../database/mongodb/models/Tactical.js';

const { Pool } = pg;

/**
 * Comprehensive database connectivity and data check
 * Tests both MongoDB and PostgreSQL connections
 */
async function checkDatabases() {
  const results = {
    mongodb: { connected: false, enabled: false, data: null, error: null },
    postgres: { connected: false, enabled: false, data: null, error: null },
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Starting Database Check...\n');
  console.log('=' .repeat(60));

  // ============================================
  // MongoDB Check
  // ============================================
  console.log('\n📦 Checking MongoDB...');
  results.mongodb.enabled = config.db.mongodb.enabled;

  if (config.db.mongodb.enabled) {
    try {
      const uri = config.db.mongodb.uri || 'mongodb://localhost:27017';
      const dbName = config.db.mongodb.dbName || 'vision_pitch_ai';

      console.log(`   URI: ${uri}`);
      console.log(`   Database: ${dbName}`);

      await mongoose.connect(uri, {
        dbName: dbName
      });

      results.mongodb.connected = true;
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

        results.mongodb.data = {
          collections: collections.length,
          trackingCount,
          collectionsList: collections.map(c => c.name)
        };
      } catch (err) {
        console.log(`   ⚠️  Error checking Tracking: ${err.message}`);
      }

      // Check Tactical data
      try {
        const tacticalCount = await Tactical.countDocuments({});
        console.log(`   📊 Tactical documents: ${tacticalCount}`);
        results.mongodb.data.tacticalCount = tacticalCount;
      } catch (err) {
        console.log(`   ⚠️  Error checking Tactical: ${err.message}`);
      }

      await mongoose.disconnect();
      console.log('   ✅ MongoDB Check Complete\n');

    } catch (err) {
      results.mongodb.error = err.message;
      console.log(`   ❌ MongoDB Connection Failed: ${err.message}\n`);
    }
  } else {
    console.log('   ⏭️  MongoDB is disabled in config (USE_MONGODB=false)\n');
  }

  // ============================================
  // PostgreSQL Check
  // ============================================
  console.log('🐘 Checking PostgreSQL...');
  results.postgres.enabled = config.db.postgres.enabled;

  if (config.db.postgres.enabled) {
    try {
      const pool = new Pool({
        host: config.db.postgres.host,
        port: config.db.postgres.port,
        database: config.db.postgres.name,
        user: config.db.postgres.user,
        password: config.db.postgres.password,
      });

      console.log(`   Host: ${config.db.postgres.host}:${config.db.postgres.port}`);
      console.log(`   Database: ${config.db.postgres.name}`);
      console.log(`   User: ${config.db.postgres.user}`);

      // Test connection
      const client = await pool.connect();
      results.postgres.connected = true;
      console.log('   ✅ PostgreSQL Connected Successfully');

      // Check tables
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      const tablesResult = await client.query(tablesQuery);
      const tables = tablesResult.rows.map(row => row.table_name);
      console.log(`   📊 Tables found: ${tables.length}`);
      tables.forEach(table => {
        console.log(`      - ${table}`);
      });

      // Check data in key tables
      const dataChecks = {};
      
      if (tables.includes('matches')) {
        const matchesCount = await client.query('SELECT COUNT(*) FROM matches');
        const count = parseInt(matchesCount.rows[0].count);
        console.log(`   🎯 Matches: ${count}`);
        dataChecks.matches = count;

        if (count > 0) {
          const sampleMatch = await client.query('SELECT * FROM matches LIMIT 1');
          console.log(`   📝 Sample match: ${sampleMatch.rows[0].home_team} vs ${sampleMatch.rows[0].away_team}`);
        }
      }

      if (tables.includes('match_summaries')) {
        const summariesCount = await client.query('SELECT COUNT(*) FROM match_summaries');
        const count = parseInt(summariesCount.rows[0].count);
        console.log(`   📊 Match Summaries: ${count}`);
        dataChecks.summaries = count;
      }

      if (tables.includes('shots')) {
        const shotsCount = await client.query('SELECT COUNT(*) FROM shots');
        const count = parseInt(shotsCount.rows[0].count);
        console.log(`   ⚽ Shots: ${count}`);
        dataChecks.shots = count;
      }

      if (tables.includes('fouls')) {
        const foulsCount = await client.query('SELECT COUNT(*) FROM fouls');
        const count = parseInt(foulsCount.rows[0].count);
        console.log(`   🟨 Fouls: ${count}`);
        dataChecks.fouls = count;
      }

      if (tables.includes('offsides')) {
        const offsidesCount = await client.query('SELECT COUNT(*) FROM offsides');
        const count = parseInt(offsidesCount.rows[0].count);
        console.log(`   🚩 Offsides: ${count}`);
        dataChecks.offsides = count;
      }

      results.postgres.data = {
        tables: tables.length,
        tablesList: tables,
        dataCounts: dataChecks
      };

      client.release();
      await pool.end();
      console.log('   ✅ PostgreSQL Check Complete\n');

    } catch (err) {
      results.postgres.error = err.message;
      console.log(`   ❌ PostgreSQL Connection Failed: ${err.message}\n`);
    }
  } else {
    console.log('   ⏭️  PostgreSQL is disabled in config (USE_POSTGRES=false)\n');
  }

  // ============================================
  // Summary
  // ============================================
  console.log('='.repeat(60));
  console.log('\n📋 Summary:');
  console.log(`   MongoDB: ${results.mongodb.enabled ? (results.mongodb.connected ? '✅ Connected' : '❌ Failed') : '⏭️  Disabled'}`);
  console.log(`   PostgreSQL: ${results.postgres.enabled ? (results.postgres.connected ? '✅ Connected' : '❌ Failed') : '⏭️  Disabled'}`);
  console.log(`   JSON Fallback: ✅ Active (always available)\n`);

  // Save results to file
  const outputFile = 'database_check_result.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${outputFile}`);

  // Also create a human-readable report
  const reportFile = 'database_check_report.txt';
  let report = 'DATABASE CHECK REPORT\n';
  report += '='.repeat(60) + '\n';
  report += `Timestamp: ${results.timestamp}\n\n`;

  report += 'MongoDB Status:\n';
  report += `  Enabled: ${results.mongodb.enabled}\n`;
  report += `  Connected: ${results.mongodb.connected ? 'Yes' : 'No'}\n`;
  if (results.mongodb.error) {
    report += `  Error: ${results.mongodb.error}\n`;
  }
  if (results.mongodb.data) {
    report += `  Collections: ${results.mongodb.data.collections}\n`;
    report += `  Tracking Documents: ${results.mongodb.data.trackingCount || 0}\n`;
    report += `  Tactical Documents: ${results.mongodb.data.tacticalCount || 0}\n`;
  }
  report += '\n';

  report += 'PostgreSQL Status:\n';
  report += `  Enabled: ${results.postgres.enabled}\n`;
  report += `  Connected: ${results.postgres.connected ? 'Yes' : 'No'}\n`;
  if (results.postgres.error) {
    report += `  Error: ${results.postgres.error}\n`;
  }
  if (results.postgres.data) {
    report += `  Tables: ${results.postgres.data.tables}\n`;
    if (results.postgres.data.dataCounts) {
      Object.entries(results.postgres.data.dataCounts).forEach(([key, value]) => {
        report += `  ${key}: ${value}\n`;
      });
    }
  }
  report += '\n';

  report += 'Current Configuration:\n';
  report += `  USE_MONGODB: ${config.db.mongodb.enabled}\n`;
  report += `  USE_POSTGRES: ${config.db.postgres.enabled}\n`;
  report += `  JSON Fallback: Always Active\n`;

  fs.writeFileSync(reportFile, report);
  console.log(`📄 Human-readable report saved to: ${reportFile}\n`);

  return results;
}

// Run the check
checkDatabases()
  .then(() => {
    console.log('✅ Database check completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database check failed:', err);
    process.exit(1);
  });

