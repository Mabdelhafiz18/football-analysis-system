import express from 'express';
import cors from 'cors';
import config from './config/config.js';
import connectMongoDB from './database/mongodb/connection.js';
import jobService from './services/jobService.js';
import matchesRouter from './routes/matches.js';
import tacticalRouter from './routes/tactical.js';
import decisionsRouter from './routes/decisions.js';
import uploadRouter from './routes/upload.js';
import authRouter from './routes/auth.js';
import analyticsRouter from './routes/analytics.js';
import analysisRouter from './routes/analysis.js';
import errorHandler from './middleware/errorHandler.js';
import liveRoutes from './routes/liveRoutes.js';

const app = express();

// Connect to MongoDB
if (config.db.mongodb.enabled) {
  connectMongoDB();
}

// Initialize job service (load persisted jobs from database)
jobService.initialize().catch(err => {
  console.warn('Job service initialization warning:', err.message);
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global locals
app.locals.dataDir = config.paths.dataDir;

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/matches', matchesRouter);
app.use('/tactical', tacticalRouter);
app.use('/decisions', decisionsRouter);
app.use('/upload', uploadRouter);
app.use('/auth', authRouter);
app.use('/analytics', analyticsRouter);
app.use('/api/live', liveRoutes);

app.use('/api/analysis', analysisRouter);

// Error Handler
app.use(errorHandler);

const PORT = config.port;
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Server running in ${config.env} mode on port ${PORT}`);
});

server.requestTimeout = config.upload.requestTimeoutMs;
server.headersTimeout = config.upload.headersTimeoutMs;
server.timeout = config.upload.requestTimeoutMs;

export default app;
