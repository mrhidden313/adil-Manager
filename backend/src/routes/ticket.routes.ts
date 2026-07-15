import { Router } from 'express';
import { createTicket, listTickets, updateTicketStatus, editTicket } from '../controllers/ticket.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// All ticket routes require authentication
router.use(requireAuth as any);

router.post('/', requireRole(['SALES', 'MANAGER', 'SUPER_ADMIN']) as any, upload.single('proof') as any, createTicket as any);
router.get('/', listTickets as any);
router.patch('/:id/status', requireRole(['MANAGER', 'FULFILLMENT', 'SUPER_ADMIN']) as any, upload.single('fulfillmentProof') as any, updateTicketStatus as any);
router.patch('/:id/edit', requireRole(['SALES', 'MANAGER', 'SUPER_ADMIN']) as any, editTicket as any);

export default router;

