import pg from 'pg';
import config from '../../config/config.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.db.postgres.host,
  port: config.db.postgres.port,
  database: config.db.postgres.name,
  user: config.db.postgres.user,
  password: config.db.postgres.password,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
