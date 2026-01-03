import postgresPool from '../connection.js';

const runMigrations = async () => {
  console.log('Running PostgreSQL migrations...');
  
  const client = await postgresPool.connect();
  try {
    await client.query('BEGIN');
    
    // Example migration: Create matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        home_team VARCHAR(100) NOT NULL,
        away_team VARCHAR(100) NOT NULL,
        date TIMESTAMP NOT NULL,
        league VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add more migrations here...

    await client.query('COMMIT');
    console.log('Migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
};

runMigrations();

