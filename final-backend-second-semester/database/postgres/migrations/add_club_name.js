import postgresPool from '../connection.js';

const addClubNameColumn = async () => {
  console.log('Adding club_name column to users table...');
  
  const client = await postgresPool.connect();
  try {
    await client.query('BEGIN');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'club_name'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('Column club_name already exists. Skipping...');
    } else {
      // Add the column
      await client.query(`
        ALTER TABLE users ADD COLUMN club_name VARCHAR(255)
      `);
      console.log('✅ Column club_name added successfully!');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

addClubNameColumn();
