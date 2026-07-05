import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import * as notifController from '../controllers/notification.controller';

const router = Router();

router.use(requireAuth);

router.get('/', notifController.getMyNotifications);
router.patch('/:id/read', notifController.markAsRead);
router.post('/request-pad', requireRole(['SALES']), notifController.requestPad);

export default router;
