import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as vaccinationController from '../controllers/vaccination.controller';

const router = Router();

router.use(authenticate);

router.get('/', vaccinationController.getVaccinations);
router.get('/due', vaccinationController.getDueVaccinations);
router.get('/:id', vaccinationController.getVaccination);

router.post(
  '/',
  authorize('vet', 'technician'),
  [
    body('animalId').notEmpty().withMessage('Animal is required'),
    body('vaccineId').notEmpty().withMessage('Vaccine is required'),
    body('doseNumber').isInt({ min: 1 }).withMessage('Dose number must be a positive integer'),
    body('dateAdministered').isISO8601().withMessage('Date administered is required'),
    body('batchNumber').trim().notEmpty().withMessage('Batch number is required'),
  ],
  validate,
  vaccinationController.recordVaccination,
);

router.patch('/:id', vaccinationController.updateVaccination);

export default router;
