import express from 'express';
import cors from 'cors';
import config from './config/config.js';
import connectMongoDB from './database/mongodb/connection.js';
import matchesRouter from './routes/matches.js';
import tacticalRouter from './routes/tactical.js';
import decisionsRouter from './routes/decisions.js';
import uploadRouter from './routes/upload.js';
import authRouter from './routes/auth.js';
import analyticsRouter from './routes/analytics.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Connect to MongoDB
if (config.db.mongodb.enabled) {
  connectMongoDB();
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
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

// Error Handler
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.env} mode on port ${PORT}`);
});

export default app;
