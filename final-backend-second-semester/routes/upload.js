import express from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import config from '../config/config.js';
import { uploadVideo, getUploadStatus } from '../controllers/uploadController.js';

// FULL_MATCH_UPLOAD_PATCH
// Large match videos are written to disk while they arrive, so Node does not
// keep a multi-gigabyte file in RAM.
const uploadDir = config.paths.uploadsDir;
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = extname(file.originalname || '').toLowerCase();
    const rawBase = extension
      ? file.originalname.slice(0, -extension.length)
      : file.originalname;
    const safeBase = (rawBase || 'match-video').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${uniqueSuffix}-${safeBase}${extension}`);
  },
});

const maxFileSize = Number(
  config.upload.maxFileSize || 5 * 1024 * 1024 * 1024,
);

const upload = multer({ 
  storage,
  limits: { fileSize: maxFileSize } // defaults to 5 GB
});

const router = express.Router();

// Upload video endpoint
router.post('/upload-video', upload.single('video'), uploadVideo);

// Upload service status endpoint
router.get('/status', getUploadStatus);

export default router;

