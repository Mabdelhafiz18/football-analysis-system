import express from 'express';
import { getTacticalData, getPassNetwork } from '../controllers/tacticalController.js';

const router = express.Router();

router.get('/match/:matchId', getTacticalData);
// GET /tactical/pass-network?match_id=1 for specific match
// GET /tactical/pass-network for aggregated pass network
router.get('/pass-network', getPassNetwork);

export default router;

