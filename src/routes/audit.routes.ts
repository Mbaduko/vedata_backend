import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as auditController from '../controllers/audit.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('superadmin'));

router.get('/', auditController.getAuditLog);
router.get('/:id', auditController.getAuditEntry);

export default router;
