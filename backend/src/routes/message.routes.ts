import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as messageController from '../controllers/message.controller';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(requireAuth);

router.get('/', messageController.getMessages);
router.post('/', upload.single('image'), messageController.sendMessage);

export default router;
