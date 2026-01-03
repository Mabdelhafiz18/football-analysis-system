import express from 'express';
import { getMatches, getMatchSummary } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getMatches);
router.get('/:matchId/summary', getMatchSummary);

export default router;

