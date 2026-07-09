import { Router } from 'express';
import { getAllUsers, deleteUser, createTeamMember, getMyTeam, toggleTeamMemberStatus, deleteTeamMember } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

// Super Admin
router.get('/all', requireRole(['SUPER_ADMIN']) as any, getAllUsers as any);
router.delete('/:id', requireRole(['SUPER_ADMIN']) as any, deleteUser as any);

// Company Team
router.get('/team', getMyTeam as any);

// Manager specific
router.post('/team', requireRole(['MANAGER']) as any, createTeamMember as any);
router.patch('/team/:id/status', requireRole(['MANAGER']) as any, toggleTeamMemberStatus as any);
router.delete('/team/:id', requireRole(['MANAGER']) as any, deleteTeamMember as any);

export default router;
