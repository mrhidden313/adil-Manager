import { Router } from 'express';
import { getCompanies, createCompany, updateCompanyStatus, getCompanyUsers, deleteCompany, updateCompanySettings, getCompanySettings } from '../controllers/company.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

// Settings accessible by MANAGER and SUPER_ADMIN
router.get('/:id/settings', requireRole(['SUPER_ADMIN', 'MANAGER']) as any, getCompanySettings as any);
router.patch('/:id/settings', requireRole(['SUPER_ADMIN', 'MANAGER']) as any, updateCompanySettings as any);

// Other routes strictly for SUPER_ADMIN
router.use(requireRole(['SUPER_ADMIN']) as any);

router.get('/', getCompanies as any);
router.post('/', createCompany as any);
router.patch('/:id/status', updateCompanyStatus as any);
router.get('/:id/users', getCompanyUsers as any);
router.delete('/:id', deleteCompany as any);

export default router;
