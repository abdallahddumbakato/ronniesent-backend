import pool from '../config/database.js';
import { DpoService } from '../services/dpoService.js';
import { sendPaymentConfirmationEmail, sendAdminPaymentNotification } from '../services/emailService.js';
// Detect provider from phone number
const detectProvider = (phoneNumber) => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  const prefix = cleaned.substring(0, 3);
  
  const prefixes = {
    mtn: ['077', '078', '079', '076'],
    airtel: ['070', '075', '074']
  };

  if (prefixes.mtn.includes(prefix)) return 'mtn';
  if (prefixes.airtel.includes(prefix)) return 'airtel';
  
  return 'mtn'; // default fallback
};

// Initialize payment - SIMPLE
export const initializePayment = async (req, res) => {
  try {
    const { planId, phoneNumber, provider } = req.body;
    const userId = req.user.userId;

    // Auto-detect provider
    const detectedProvider = provider || detectProvider(phoneNumber);

    // Get user and plan
    const [userResult, planResult] = await Promise.all([
      pool.query('SELECT * FROM userz WHERE id = $1', [userId]),
      pool.query('SELECT * FROM subscription_planz WHERE id = $1', [planId])
    ]);

    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const user = userResult.rows[0];
    const plan = planResult.rows[0];
    const companyRef = `RONNIE'S ENTERTAINMENT-${Date.now()}-${userId}`;

    // STEP 1: Create token
    const dpoResult = await DpoService.createToken({
      amount: parseFloat(plan.amount),
      currency: plan.currency || 'UGX',
      companyRef,
      customerEmail: user.email,
      customerPhone: phoneNumber,
      customerFirstName: user.full_name.split(' ')[0],
      customerLastName: user.full_name.split(' ').slice(1).join(' ') || 'User',
      redirectURL: `${process.env.DPO_REDIRECT_SUCCESS_BASE_URL}?token=${companyRef}`,
      backURL: process.env.DPO_REDIRECT_CANCEL_BASE_URL
    });

    const transactionToken = dpoResult.TransToken;

    // STEP 2: Charge mobile money
    const mno = DpoService.getMnoCode(detectedProvider);
    
    const chargeResult = await DpoService.chargeTokenMobile(transactionToken, phoneNumber, mno);

    // STEP 3: Store payment (REMOVED duration_days)
    await pool.query(
      `INSERT INTO paymentz (user_id, plan_id, amount, currency, transaction_token, company_ref, status, provider, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
      [userId, planId, plan.amount, plan.currency, transactionToken, companyRef, detectedProvider, phoneNumber]
    );

    // STEP 4: Return success
    res.json({
      success: true,
      transactionToken,
      instructions: chargeResult.instructions,
      statusCode: chargeResult.StatusCode,
      provider: detectedProvider,
      message: 'Payment initiated! Check your phone for PIN prompt.'
    });

  } catch (error) {
    console.error('🔴 PAYMENT ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Verify payment
export const verifyPayment = async (req, res) => {
  try {
    const { transactionToken } = req.body;

    const verifyResult = await DpoService.verifyToken(transactionToken);

    // FIX: Handle different payment statuses
    if (verifyResult.Result == 0) {
      // ✅ FIX: First check current status BEFORE updating
      const currentPaymentResult = await pool.query(
        'SELECT status FROM paymentz WHERE transaction_token = $1',
        [transactionToken]
      );
      
      const wasAlreadyCompleted = currentPaymentResult.rows[0]?.status === 'completed';

      // Payment successful - activate subscription
      const paymentResult = await pool.query(
        `UPDATE paymentz 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE transaction_token = $1 RETURNING *`,
        [transactionToken]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      const payment = paymentResult.rows[0];

      // ✅ FIX: Only send emails if payment was NOT already completed
      if (!wasAlreadyCompleted) {
        
        // Get plan's end_date for seasonal expiry
        const planResult = await pool.query('SELECT end_date FROM subscription_planz WHERE id = $1', [payment.plan_id]);
        const plan = planResult.rows[0];

        await pool.query(
          `UPDATE userz SET subscription_plan_id = $1, subscription_expiry = $2 WHERE id = $3`,
          [payment.plan_id, plan.end_date, payment.user_id]
        );

        const userResult = await pool.query('SELECT * FROM userz WHERE id = $1', [payment.user_id]);
        const user = userResult.rows[0];

        const planDetailsResult = await pool.query('SELECT * FROM subscription_planz WHERE id = $1', [payment.plan_id]);
        const planDetails = planDetailsResult.rows[0];

        // ✅ SEND EMAIL NOTIFICATIONS ONLY ONCE
        try {
          // 1. Send payment confirmation email to customer (WITH PDF)
          await sendPaymentConfirmationEmail(
            user.email,
            user.full_name,
            payment.amount,
            transactionToken,
            payment.company_ref,
            planDetails.name
          );

          // 2. Send admin notification
          await sendAdminPaymentNotification(
            user.full_name,
            payment.amount,
            transactionToken,
            payment.company_ref
          );
        } catch (emailError) {
          console.error('❌ Email notification error (non-blocking):', emailError);
          // Don't fail the payment if emails fail
        }
      } else {
      }

      const userResult = await pool.query('SELECT * FROM userz WHERE id = $1', [payment.user_id]);
      const user = userResult.rows[0];

      return res.json({
        success: true,
        status: 'completed',
        message: 'Payment verified successfully! Your subscription is now active.',
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          subscriptionPlanId: user.subscription_plan_id,
          subscriptionExpiry: user.subscription_expiry,
          createdAt: user.created_at
        }
      });
    } else if (['900', '903'].includes(verifyResult.Result)) {
      // Payment still pending
      return res.json({
        success: false,
        status: 'pending',
        message: 'Payment is still processing. Please wait...'
      });
    } else {
      // Payment failed
      return res.status(400).json({
        success: false,
        error: verifyResult.ResultExplanation || 'Payment verification failed'
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const { transactionToken } = req.params;

    const paymentResult = await pool.query(
      'SELECT * FROM paymentz WHERE transaction_token = $1',
      [transactionToken]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    res.json({
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      createdAt: payment.created_at
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};