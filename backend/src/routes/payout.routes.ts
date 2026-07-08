import { Router } from 'express';
import { createPayout, listPayouts, approvePayout } from '../controllers/payout.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(requireAuth as any);

router.post('/pay', requireRole(['MANAGER', 'SUPER_ADMIN']) as any, upload.single('proof') as any, createPayout as any);
router.get('/', listPayouts as any);
router.patch('/:id/approve', requireRole(['SALES']) as any, approvePayout as any);

export default router;
