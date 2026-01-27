import { writeFile } from 'fs/promises';
import { join } from 'path';
import jobService from '../services/jobService.js';
import databaseService from '../services/databaseService.js';
import azureStorageService from '../services/azureStorageService.js';
import aiPollingService from '../services/aiPollingService.js';
import config from '../config/config.js';

/**
 * Save file to local storage as fallback
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original filename
 * @returns {Promise<{filename: string, path: string}>}
 */
async function saveToLocalStorage(buffer, originalname) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filename = `${uniqueSuffix}-${originalname}`;
  const filepath = join(config.paths.uploadsDir, filename);
  
  await writeFile(filepath, buffer);
  
  return {
    filename,
    path: filepath
  };
}

/**
 * POST /upload/upload-video
 * Handles video upload and initiates processing
 * Form data: video (file), homeTeam, awayTeam, date, league (optional)
 * 
 * Upload strategy:
 * 1. Try Azure Storage first (if enabled)
 * 2. Fall back to local storage if Azure fails
 * 
 * Processing strategy:
 * 1. Try AI service first (if available)
 * 2. Fall back to simulation mode if AI service unavailable
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

    let videoUrl = null;
    let videoPath = null;
    let videoFilename = req.file.originalname;
    let storageType = 'local';

    // Try Azure Storage first if enabled
    if (azureStorageService.isEnabled()) {
      try {
        console.log('Attempting to upload video to Azure Storage...');
        const azureResult = await azureStorageService.uploadVideo(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        
        videoUrl = azureResult.url;
        videoFilename = azureResult.blobName;
        storageType = 'azure';
        console.log(`Video uploaded to Azure Storage: ${videoUrl}`);
      } catch (azureError) {
        console.warn('Azure upload failed, falling back to local storage:', azureError.message);
      }
    }

    // Fallback to local storage if Azure failed or is disabled
    if (!videoUrl) {
      try {
        console.log('Saving video to local storage...');
        const localResult = await saveToLocalStorage(req.file.buffer, req.file.originalname);
        videoPath = localResult.path;
        videoFilename = localResult.filename;
        videoUrl = localResult.path; // Use local path as URL for compatibility
        storageType = 'local';
        console.log(`Video saved locally: ${videoPath}`);
      } catch (localError) {
        console.error('Local storage failed:', localError.message);
        return res.status(500).json({
          error: 'StorageError',
          message: 'Failed to store video. Please try again.'
        });
      }
    }

    // Create match info object
    const matchInfo = {
      homeTeam,
      awayTeam,
      date,
      league: league || null,
      video_filename: videoFilename,
      video_path: videoPath,
      video_url: videoUrl,
      storage_type: storageType
    };

    // Create processing job
    const job = await jobService.createJob(matchInfo);

    // Try to start AI processing
    let processingMode = 'ai';
    try {
      // Check if AI service is available
      const aiAvailable = await aiPollingService.isAIServiceAvailable();
      
      if (aiAvailable) {
        // Start AI processing - this will poll for results in background
        await aiPollingService.startProcessing(job.match_id, matchInfo);
        console.log(`AI processing started for match ${job.match_id}`);
      } else {
        // AI service not available - use simulation mode
        console.warn('AI service not available, using simulation mode');
        processingMode = 'simulation';
        jobService.enableSimulation();
        // Re-run the simulation for this job
        jobService._simulateProgress(job.match_id);
      }
    } catch (aiError) {
      // AI service error - fall back to simulation mode
      console.warn('AI service error, falling back to simulation:', aiError.message);
      processingMode = 'simulation';
      
      // Enable simulation and run for this job if not already failed
      if (job.status !== 'failed') {
        jobService.enableSimulation();
        jobService._simulateProgress(job.match_id);
      }
    }

    // Return response per API contract
    res.status(200).json({
      match_id: job.match_id,
      status: job.status,
      message: `Video uploaded successfully to ${storageType} storage. Processing started (${processingMode} mode).`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /upload/status
 * Returns the upload service status
 */
export const getUploadStatus = async (req, res, next) => {
  try {
    const aiAvailable = await aiPollingService.isAIServiceAvailable();
    const activeJobs = aiPollingService.getActiveJobCount();
    const jobCounts = jobService.getJobCounts();

    res.json({
      status: 'healthy',
      storage: {
        azure: azureStorageService.isEnabled(),
        local: true
      },
      ai_service: {
        available: aiAvailable,
        url: config.ai.url,
        polling_interval_ms: config.ai.pollingInterval
      },
      jobs: {
        active_polling: activeJobs,
        ...jobCounts
      },
      simulation_mode: jobService.isSimulationEnabled()
    });
  } catch (err) {
    next(err);
  }
};
