import { EventEmitter } from 'events';

class LiveEventService extends EventEmitter {
  emitModelResult(matchId, payload) {
    this.emit('model_result_' + matchId, payload);
  }

  emitMatchStatus(matchId, payload) {
    this.emit('match_status_' + matchId, payload);
  }

  subscribeToMatch(matchId, onData) {
    const modelEventName = 'model_result_' + matchId;
    const statusEventName = 'match_status_' + matchId;

    const modelHandler = (payload) => {
      onData({
        type: 'model_result',
        match_id: matchId,
        data: payload
      });
    };

    const statusHandler = (payload) => {
      onData({
        type: 'match_status',
        match_id: matchId,
        data: payload
      });
    };

    this.on(modelEventName, modelHandler);
    this.on(statusEventName, statusHandler);

    return () => {
      this.off(modelEventName, modelHandler);
      this.off(statusEventName, statusHandler);
    };
  }
}

const liveEventService = new LiveEventService();
export default liveEventService;