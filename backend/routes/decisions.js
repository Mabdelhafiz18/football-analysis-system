import express from 'express';
import { getOffsides, getFouls, getGoalPredictions } from '../controllers/decisionController.js';

const router = express.Router();

router.get('/offside', getOffsides);
router.get('/fouls', getFouls);
router.get('/goal-prediction', getGoalPredictions);

export default router;

