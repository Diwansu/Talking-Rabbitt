import express from 'express';
import multer from 'multer';
import os from 'os';
import { handleUpload } from '../controllers/upload.js';
import { handleChat } from '../controllers/chat.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

router.post('/upload', upload.single('file'), handleUpload);
router.post('/chat', handleChat);

export default router;
