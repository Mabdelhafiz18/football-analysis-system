import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgresPool from '../connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const runMigrations = async () => {
  console.log('Running PostgreSQL migrations...');

  const client = await postgresPool.connect();
  try {
    await client.query('BEGIN');

    // Define the order of SQL files to execute
    // Type.sql MUST run first to define Enums
    // matches.sql MUST run before events/summaries (Foreign Keys)
    const sqlFiles = [
      'Type.sql',
      'matches.sql',
      'users.sql',
      'processing_jobs.sql',
      'offsides.sql',
      'fouls.sql',
      'shots.sql',
      'match_summaries.sql',
      'index.sql'
    ];

    const sqlDir = join(__dirname, '..'); // Files are in the parent directory (postgres/)

    for (const file of sqlFiles) {
      console.log(`Executing ${file}...`);
      const filePath = join(sqlDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');
      await client.query(sql);
    }

    await client.query('COMMIT');
    console.log('Migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    // Do not exit immediately to allow pool to close gracefully if needed, 
    // but here we are a script so we can exit.
    process.exit(0);
  }
};

runMigrations();

