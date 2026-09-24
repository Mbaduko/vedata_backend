import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as zoneController from '../controllers/zone.controller';

const router = Router();

router.use(authenticate);

router.get('/', zoneController.getZones);
router.get('/tree', zoneController.getZoneTree);
router.get('/:id', zoneController.getZone);

router.post(
  '/',
  authorize('superadmin'),
  [
    body('name').trim().notEmpty().withMessage('Zone name is required'),
    body('label').optional().trim(),
    body('parentZoneId').optional().isString(),
    body('technicianGracePeriodHours').optional().isInt({ min: 1 }),
    body('inviteExpiryHours').optional().isInt({ min: 1 }),
  ],
  validate,
  zoneController.createZone,
);

router.patch('/:id', authorize('superadmin'), zoneController.updateZone);

router.post(
  '/:id/move',
  authorize('superadmin'),
  [body('newParentId').optional().isString()],
  validate,
  zoneController.moveZone,
);

router.post('/:id/archive', authorize('superadmin'), zoneController.archiveZone);

export default router;
