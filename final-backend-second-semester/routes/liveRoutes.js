import express from 'express';
import liveEventService from '../services/liveEventService.js';

const router = express.Router();

router.get('/match/:matchId', (req, res) => {
  const matchId = parseInt(req.params.matchId, 10);

  if (!matchId) {
    return res.status(400).json({
      error: 'Invalid match id'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.write(
    'data: ' +
      JSON.stringify({
        type: 'connected',
        match_id: matchId,
        message: 'Live connection opened'
      }) +
      '\n\n'
  );

  const unsubscribe = liveEventService.subscribeToMatch(matchId, (payload) => {
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
  });

  const heartbeat = setInterval(() => {
    res.write(
      'data: ' +
        JSON.stringify({
          type: 'heartbeat',
          match_id: matchId,
          timestamp: new Date().toISOString()
        }) +
        '\n\n'
    );
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;