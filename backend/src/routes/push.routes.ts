import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as pushController from '../controllers/push.controller';

const router = Router();

router.use(requireAuth);

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);

export default router;
