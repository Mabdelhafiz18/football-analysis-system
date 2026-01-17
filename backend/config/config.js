import dotenv from 'dotenv';
import paths from '../utils/pathUtils.js';

dotenv.config({ path: `${paths.backendDir}/.env` });

export const config = {
  port: process.env.PORT || 8000,
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  paths,
  db: {
    postgres: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      enabled: process.env.USE_POSTGRES === 'true'
    },
    mongodb: {
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME,
      enabled: process.env.USE_MONGODB === 'true'
    }
  },
  ai: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:5000',
    pollingInterval: parseInt(process.env.AI_POLLING_INTERVAL, 10) || 5000
  }
};

export default config;
