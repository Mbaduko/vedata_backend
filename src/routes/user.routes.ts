import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as userController from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('superadmin'), userController.getUsers);
router.get('/:id', userController.getUser);
router.post('/', authorize('superadmin'), userController.createUser);
router.patch('/:id', authorize('superadmin'), userController.updateUser);
router.post('/:id/assign-zone', authorize('superadmin'), userController.assignToZone);

export default router;
