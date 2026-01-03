import express from 'express';
import multer from 'multer';
import { uploadVideo } from '../controllers/uploadController.js';
import config from '../config/config.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.paths.uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } 
});

const router = express.Router();

router.post('/upload-video', upload.single('video'), uploadVideo);

export default router;

