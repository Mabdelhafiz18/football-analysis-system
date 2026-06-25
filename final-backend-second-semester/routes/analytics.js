import express from 'express';
import { getAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

// Get aggregated analytics across all matches
router.get('/', getAnalytics);

export default router;

