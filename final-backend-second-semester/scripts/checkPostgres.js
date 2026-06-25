import pg from 'pg';
import config from '../config/config.js';

const { Pool } = pg;

/**
 * PostgreSQL Database Check Script
 * Tests connection and shows database structure
 */
async function checkPostgres() {
  const results = {
    connected: false,
    enabled: config.db.postgres.enabled,
    config: {
      host: config.db.postgres.host,
      port: config.db.postgres.port,
      database: config.db.postgres.name,
      user: config.db.postgres.user
    },
    tables: [],
    data: {},
    error: null,
    timestamp: new Date().toISOString()
  };

  console.log('🐘 PostgreSQL Database Check');
  console.log('='.repeat(60));

  if (!config.db.postgres.enabled) {
    console.log('⏭️  PostgreSQL is disabled in config (USE_POSTGRES=false)');
    console.log('   To enable, set USE_POSTGRES=true in .env file\n');
    return results;
  }

  try {
    const pool = new Pool({
      host: config.db.postgres.host,
      port: config.db.postgres.port,
      database: config.db.postgres.name,
      user: config.db.postgres.user,
      password: config.db.postgres.password,
    });

    console.log(`\n📋 Configuration:`);
    console.log(`   Host: ${config.db.postgres.host}:${config.db.postgres.port}`);
    console.log(`   Database: ${config.db.postgres.name}`);
    console.log(`   User: ${config.db.postgres.user}`);

    // Test connection
    const client = await pool.connect();
    results.connected = true;
    console.log('\n✅ PostgreSQL Connected Successfully!\n');

    // Get PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log(`📌 PostgreSQL Version:`);
    console.log(`   ${versionResult.rows[0].version.split(',')[0]}\n`);

    // Check tables
    console.log('📊 Checking Tables...');
    const tablesQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tablesResult = await client.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.table_name);
    
    console.log(`   Found ${tables.length} table(s):\n`);
    
    results.tables = tables;

    // Check data in each table
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        results.data[table] = count;
        
        const columnCount = tablesResult.rows.find(r => r.table_name === table)?.column_count || 0;
        console.log(`   📋 ${table}`);
        console.log(`      Rows: ${count}`);
        console.log(`      Columns: ${columnCount}`);

        // Show sample data for key tables
        if (count > 0 && ['matches', 'match_summaries'].includes(table)) {
          const sample = await client.query(`SELECT * FROM ${table} LIMIT 1`);
          if (table === 'matches') {
            const match = sample.rows[0];
            console.log(`      Sample: ${match.home_team || 'N/A'} vs ${match.away_team || 'N/A'}`);
          }
        }
        console.log('');
      } catch (err) {
        console.log(`   ⚠️  Error checking ${table}: ${err.message}\n`);
        results.data[table] = { error: err.message };
      }
    }

    // Check for foreign keys and relationships
    console.log('🔗 Checking Relationships...');
    const fkQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `;
    const fkResult = await client.query(fkQuery);
    
    if (fkResult.rows.length > 0) {
      console.log(`   Found ${fkResult.rows.length} foreign key relationship(s):\n`);
      fkResult.rows.forEach(fk => {
        console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('   No foreign keys found\n');
    }

    client.release();
    await pool.end();

    console.log('='.repeat(60));
    console.log('✅ PostgreSQL Check Complete!\n');

  } catch (err) {
    results.error = err.message;
    console.log(`\n❌ PostgreSQL Connection Failed:`);
    console.log(`   Error: ${err.message}\n`);
    
    if (err.code === 'ECONNREFUSED') {
      console.log('💡 Troubleshooting:');
      console.log('   1. Make sure PostgreSQL is running');
      console.log('   2. Check host and port in .env file');
      console.log('   3. Verify database exists');
    } else if (err.code === '28P01') {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check username and password in .env file');
      console.log('   2. Verify user has access to database');
    }
    console.log('');
  }

  return results;
}

// Run the check
checkPostgres()
  .then((results) => {
    if (results.connected) {
      console.log('📊 Summary:');
      console.log(`   Tables: ${results.tables.length}`);
      console.log(`   Total Records: ${Object.values(results.data).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0)}`);
    }
    process.exit(results.connected ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });






