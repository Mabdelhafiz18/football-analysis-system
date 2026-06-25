import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import jobService from '../services/jobService.js';
import databaseService from '../services/databaseService.js';
import config from '../config/config.js';
import orchestratorService from '../services/orchestratorService.js';

async function saveBufferToLocalStorage(buffer, originalname) {
  await mkdir(config.paths.uploadsDir, { recursive: true });

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1000000000);
  const safeOriginalName = basename(originalname || 'uploaded-video.mp4');
  const filename = uniqueSuffix + '-' + safeOriginalName;
  const filepath = join(config.paths.uploadsDir, filename);

  await writeFile(filepath, buffer);

  return {
    filename,
    path: resolve(filepath)
  };
}

async function resolveUploadedVideo(file) {
  // Preferred path for large files: Multer diskStorage writes directly to disk.
  if (file?.path) {
    const filepath = resolve(file.path);

    return {
      filename: file.filename || basename(filepath),
      path: filepath
    };
  }

  // Compatibility fallback for the previous memoryStorage configuration.
  if (file?.buffer) {
    return saveBufferToLocalStorage(file.buffer, file.originalname);
  }

  throw new Error('Uploaded file has neither a disk path nor an in-memory buffer');
}

async function removeUploadedFileOnValidationFailure(file) {
  if (!file?.path) return;

  try {
    await unlink(resolve(file.path));
  } catch {
    // Ignore cleanup failure; the original validation error is more important.
  }
}

async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No video file uploaded'
      });
    }

    const homeTeam = req.body.homeTeam;
    const awayTeam = req.body.awayTeam;
    const matchDate = req.body.date;
    const league = req.body.league;

    if (!homeTeam || !awayTeam || !matchDate) {
      await removeUploadedFileOnValidationFailure(req.file);

      return res.status(400).json({
        error: 'BadRequest',
        message: 'homeTeam, awayTeam, and date are required fields'
      });
    }

    console.log('Resolving uploaded video from disk storage...');

    const localResult = await resolveUploadedVideo(req.file);

    const matchInfo = {
      homeTeam,
      awayTeam,
      date: matchDate,
      league: league || null,
      video_filename: localResult.filename,
      video_path: localResult.path,
      video_url: localResult.path,
      storage_type: 'local'
    };

    console.log('Video available locally: ' + localResult.path);

    const match = await databaseService.createMatch(matchInfo);

    matchInfo.match_id = match.id;

    const job = await jobService.createJob(matchInfo);
    orchestratorService.startProcessing(matchInfo);

    console.log('Upload complete. Match saved with id: ' + match.id);
    console.log('Processing job created with match_id: ' + job.match_id);
    console.log('Vision + Tactical + xG + Offside + Foul orchestration started.');

    return res.status(200).json({
      match_id: job.match_id,
      status: job.status,
      message: 'Video uploaded successfully. Match and processing job saved.'
    });
  } catch (err) {
    next(err);
  }
}

async function getUploadStatus(req, res, next) {
  try {
    const jobCounts = jobService.getJobCounts();

    return res.json({
      status: 'healthy',
      storage: {
        local: true,
        azure: false,
        upload_mode: 'disk'
      },
      models: {
        vision: config.models.vision.url,
        tactical: config.models.tactical.url,
        xg: config.models.xg.url,
        foul: config.models.foul.url,
        offside: config.models.offside.url
      },
      jobs: {
        processing: jobCounts.processing,
        pending: jobCounts.pending,
        completed: jobCounts.completed,
        failed: jobCounts.failed
      },
      old_ai_service_removed: true
    });
  } catch (err) {
    next(err);
  }
}

export {
  uploadVideo,
  getUploadStatus
};
