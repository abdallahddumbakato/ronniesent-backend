import express from 'express';
import { getPlans, createPlan, updatePlan, deletePlan, togglePlanActivation } from '../controllers/planController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public route - get plans (for subscription page)
router.get('/', getPlans);

// Protected routes (admin only)
router.use(authenticateToken);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);
router.patch('/:id/activate', togglePlanActivation);

export default router;