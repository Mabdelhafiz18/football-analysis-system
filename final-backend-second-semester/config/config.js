import dotenv from 'dotenv';
import paths from '../utils/pathUtils.js';

dotenv.config({ path: paths.backendDir + '/.env' });

const config = {
port: process.env.PORT || 8000,
env: process.env.NODE_ENV || 'development',
jwtSecret: process.env.JWT_SECRET,
paths: paths,
upload: {
maxFileSize: Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024 * 1024),
requestTimeoutMs: Number(process.env.UPLOAD_REQUEST_TIMEOUT_MS || 2 * 60 * 60 * 1000),
headersTimeoutMs: Number(process.env.UPLOAD_HEADERS_TIMEOUT_MS || 2 * 60 * 60 * 1000 + 60000)
},
requests: {
visionTimeoutMs: Number(process.env.VISION_REQUEST_TIMEOUT_MS || 45 * 60 * 1000),
modelWindowTimeoutMs: Number(process.env.MODEL_WINDOW_TIMEOUT_MS || 10 * 60 * 1000),
foulTimeoutMs: Number(process.env.FOUL_REQUEST_TIMEOUT_MS || 10 * 60 * 1000),
retryCount: Number(process.env.MODEL_REQUEST_RETRIES || 1),
retryDelayMs: Number(process.env.MODEL_REQUEST_RETRY_DELAY_MS || 2000)
},
orchestration: {
windowSize: Number(process.env.MODEL_WINDOW_SIZE || 50),
modelWindowConcurrency: Number(process.env.MODEL_WINDOW_CONCURRENCY || 4)
},

db: {
postgres: {
host: process.env.DB_HOST || 'localhost',
port: process.env.DB_PORT || 5432,
name: process.env.DB_NAME || 'vision_ai',
user: process.env.DB_USER || 'postgres',
password: process.env.DB_PASSWORD || '',
enabled: process.env.USE_POSTGRES === 'true'
},
mongodb: {
uri: process.env.MONGODB_URI || '',
dbName: process.env.MONGODB_DB_NAME || '',
enabled: process.env.USE_MONGODB === 'true'
}
},

azure: {
connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos',
enabled: process.env.USE_AZURE_STORAGE === 'true'
},

models: {
vision: {
url: process.env.VISION_SERVICE_URL
},
tactical: {
url: process.env.TACTICAL_SERVICE_URL
},
xg: {
url: process.env.XG_SERVICE_URL
},
foul: {
url: process.env.FOUL_SERVICE_URL
},
offside: {
url: process.env.OFFSIDE_SERVICE_URL
}
}
};

export default config;
export { config };
