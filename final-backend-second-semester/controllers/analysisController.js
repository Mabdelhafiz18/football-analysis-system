import analysisDataService from '../services/analysisDataService.js';

export const getMatchAnalysis = async (req, res, next) => {
  try {
    const data = await analysisDataService.getMatchAnalysis(req.params.matchId);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getModelWindows = async (req, res, next) => {
  try {
    const rows = await analysisDataService.getModelWindows(req.params.matchId, req.query.model);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

export const streamMatchVideo = async (req, res, next) => {
  try {
    const media = await analysisDataService.resolveVideo(req.params.matchId);
    if (media.type === 'remote') {
      return res.redirect(media.url);
    }

    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(media.path);
  } catch (error) {
    next(error);
  }
};
