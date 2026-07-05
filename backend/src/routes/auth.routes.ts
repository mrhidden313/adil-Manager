import { Router } from 'express';
import { login, register, getMe, updateProfile, impersonate } from '../controllers/auth.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/login', login as any);
router.post('/register', requireAuth as any, requireRole(['SUPER_ADMIN']) as any, register as any);
router.get('/me', requireAuth as any, getMe as any);
router.patch('/profile', requireAuth as any, upload.single('profilePicture') as any, updateProfile as any);

router.post('/impersonate', requireAuth as any, requireRole(['SUPER_ADMIN']) as any, impersonate as any);

export default router;
