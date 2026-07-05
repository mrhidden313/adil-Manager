import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import * as padController from '../controllers/pad.controller';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(requireAuth);

// Manager can create pads, view all, update status
router.post('/', requireRole(['MANAGER', 'SUPER_ADMIN']), padController.createPad);
router.get('/company', requireRole(['MANAGER', 'SUPER_ADMIN']), padController.getCompanyPads);
router.patch('/:id/status', requireRole(['MANAGER', 'SUPER_ADMIN']), padController.updatePadStatus);
router.patch('/:id/extra-paid', requireRole(['MANAGER', 'SUPER_ADMIN']), upload.single('proof'), padController.updatePadExtraPaid);

// Sales agent can view their own pads
router.get('/my-pads', requireRole(['SALES']), padController.getMyPads);

// Anyone can view a specific pad (if they own it or manage it)
router.get('/:id', padController.getPadById);

export default router;
