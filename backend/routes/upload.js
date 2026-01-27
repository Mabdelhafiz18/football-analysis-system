import express from 'express';
import multer from 'multer';
import { uploadVideo, getUploadStatus } from '../controllers/uploadController.js';

// Use memory storage to allow streaming to Azure or saving locally
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

const router = express.Router();

// Upload video endpoint
router.post('/upload-video', upload.single('video'), uploadVideo);

// Upload service status endpoint
router.get('/status', getUploadStatus);

export default router;

