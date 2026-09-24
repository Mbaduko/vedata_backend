import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import * as diseaseController from '../controllers/disease.controller';

const router = Router();

router.use(authenticate);

// Diseases
router.get('/', diseaseController.getDiseases);

router.post(
  '/',
  authorize('superadmin'),
  [
    body('name').trim().notEmpty().withMessage('Disease name is required'),
    body('applicableSpeciesIds').isArray().withMessage('Applicable species must be an array'),
  ],
  validate,
  diseaseController.createDisease,
);

router.patch('/:id', authorize('superadmin'), diseaseController.updateDisease);

// Vaccines
router.get('/:diseaseId/vaccines', diseaseController.getVaccines);

router.post(
  '/:diseaseId/vaccines',
  authorize('superadmin'),
  [body('name').trim().notEmpty().withMessage('Vaccine name is required')],
  validate,
  diseaseController.createVaccine,
);

router.patch('/vaccines/:vaccineId', authorize('superadmin'), diseaseController.updateVaccine);

// Schedules
router.get('/vaccines/:vaccineId/schedules', diseaseController.getSchedules);

router.post(
  '/vaccines/:vaccineId/schedules',
  authorize('superadmin'),
  [
    body('doseNumber').isInt({ min: 1 }).withMessage('Dose number must be positive'),
    body('intervalDaysFromPrevious').isInt({ min: 0 }).withMessage('Interval must be non-negative'),
  ],
  validate,
  diseaseController.createSchedule,
);

router.delete('/schedules/:scheduleId', authorize('superadmin'), diseaseController.deleteSchedule);

export default router;
