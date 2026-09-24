import { Router } from 'express';
import authRoutes from './auth.routes';
import zoneRoutes from './zone.routes';
import userRoutes from './user.routes';
import animalRoutes from './animal.routes';
import ownerRoutes from './owner.routes';
import vaccinationRoutes from './vaccination.routes';
import diseaseRoutes from './disease.routes';
import teamRoutes from './team.routes';
import auditRoutes from './audit.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/zones', zoneRoutes);
router.use('/users', userRoutes);
router.use('/animals', animalRoutes);
router.use('/owners', ownerRoutes);
router.use('/vaccinations', vaccinationRoutes);
router.use('/diseases', diseaseRoutes);
router.use('/team', teamRoutes);
router.use('/audit', auditRoutes);

export default router;
