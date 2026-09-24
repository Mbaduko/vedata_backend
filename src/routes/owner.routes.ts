import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as ownerController from '../controllers/owner.controller';

const router = Router();

router.use(authenticate);

router.get('/', ownerController.getOwners);
router.get('/:id', ownerController.getOwner);

router.post(
  '/',
  authorize('vet', 'technician'),
  [
    body('nid').trim().notEmpty().withMessage('National ID is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').optional({ nullable: true }).isEmail(),
    body('zoneId').notEmpty().withMessage('Zone is required'),
  ],
  validate,
  ownerController.createOwner,
);

router.patch('/:id', ownerController.updateOwner);

export default router;
