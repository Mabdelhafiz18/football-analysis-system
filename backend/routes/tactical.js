import express from 'express';
import { getTacticalData, getHeatmap, getPassNetwork } from '../controllers/tacticalController.js';

const router = express.Router();

router.get('/match/:matchId', getTacticalData);
router.get('/heatmap', getHeatmap);
router.get('/pass-network', getPassNetwork);

export default router;

