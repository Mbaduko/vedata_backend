import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as animalController from '../controllers/animal.controller';

const router = Router();

router.use(authenticate);

router.get('/', animalController.getAnimals);
router.get('/:id', animalController.getAnimal);

router.post(
  '/',
  authorize('vet', 'technician'),
  [
    body('tagNumber').trim().notEmpty().withMessage('Tag number is required'),
    body('speciesId').notEmpty().withMessage('Species is required'),
    body('sex').isIn(['male', 'female']).withMessage('Sex must be male or female'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
    body('ownerId').notEmpty().withMessage('Owner is required'),
    body('zoneId').notEmpty().withMessage('Zone is required'),
  ],
  validate,
  animalController.createAnimal,
);

router.patch('/:id', animalController.updateAnimal);

router.post(
  '/:id/deceased',
  authorize('vet', 'superadmin'),
  [
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('date').isISO8601().withMessage('Date of death is required'),
  ],
  validate,
  animalController.markDeceased,
);

router.delete('/:id', authorize('vet', 'superadmin'), animalController.deleteAnimal);

export default router;
