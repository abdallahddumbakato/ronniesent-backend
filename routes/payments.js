import express from 'express';
import { initializePayment, verifyPayment, getPaymentStatus } from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/initialize', initializePayment);
router.post('/verify', verifyPayment);
router.get('/status/:transactionToken', getPaymentStatus);

export default router;