import express from 'express';
import { 
  requestReset, 
  resetPassword, 
  changePassword 
} from '../controllers/passwordController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/request-reset', requestReset);
router.post('/reset', resetPassword);

// Protected route (requires login)
router.post('/change', authenticateToken, changePassword);

export default router;