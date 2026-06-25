import express from 'express';
import {
  getMatchAnalysis,
  getModelWindows,
  streamMatchVideo,
} from '../controllers/analysisController.js';

const router = express.Router();

router.get('/matches/:matchId', getMatchAnalysis);
router.get('/matches/:matchId/windows', getModelWindows);
router.get('/matches/:matchId/video', streamMatchVideo);

export default router;
