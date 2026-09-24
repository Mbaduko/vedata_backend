import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as teamController from '../controllers/team.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('vet', 'superadmin'));

router.get('/', teamController.getTechnicians);
router.get('/:id', teamController.getTechnician);

router.post(
  '/invite',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('zoneId').notEmpty().withMessage('Zone is required'),
    body('contractStart').isISO8601().withMessage('Contract start date is required'),
    body('contractEnd').isISO8601().withMessage('Contract end date is required'),
    body('inviteExpiryHours').optional().isInt({ min: 1 }),
  ],
  validate,
  teamController.inviteTechnician,
);

router.patch(
  '/:id/contract',
  [body('contractEnd').isISO8601().withMessage('New contract end date is required')],
  validate,
  teamController.extendContract,
);

export default router;
