import jobService from '../services/jobService.js';
import databaseService from '../services/databaseService.js';

/**
 * POST /upload/upload-video
 * Handles video upload and initiates processing
 * Form data: video (file), homeTeam, awayTeam, date, league (optional)
 */
export const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No video file uploaded'
      });
    }

    const { homeTeam, awayTeam, date, league } = req.body;

    // Validate required fields
    if (!homeTeam || !awayTeam || !date) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'homeTeam, awayTeam, and date are required fields'
      });
    }

    // Create match info object
    const matchInfo = {
      homeTeam,
      awayTeam,
      date,
      league: league || null,
      video_filename: req.file.filename,
      video_path: req.file.path
    };

    // Create processing job
    const job = jobService.createJob(matchInfo);

    // Return response per API contract
    res.status(200).json({
      match_id: job.match_id,
      status: job.status,
      message: 'Video uploaded successfully. Processing started.'
    });
  } catch (err) {
    next(err);
  }
};
