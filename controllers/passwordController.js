// backend/controllers/passwordController.js
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/emailService.js'; // Add this import

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Generate random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request password reset
export const requestReset = async (req, res) => {
  try {
    const { emailOrPhone } = req.body;

    // Find user by email or phone
    const result = await pool.query(
      `SELECT * FROM userz WHERE email = $1 OR phone = $1`,
      [emailOrPhone]
    );

    if (result.rows.length === 0) {
      // Don't reveal if user exists for security
      return res.json({ 
        message: 'If the email/phone exists, a reset code has been sent' 
      });
    }

    const user = result.rows[0];
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(user.email, { otp, expiresAt });
    otpStore.set(user.phone, { otp, expiresAt });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, otp, user.full_name);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
    }

    res.json({ 
      message: 'If the email/phone exists, a reset code has been sent',
      // In development, return OTP for testing
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('Request reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify OTP and reset password
export const resetPassword = async (req, res) => {
  try {
    const { emailOrPhone, otp, newPassword } = req.body;

    // Find stored OTP
    const storedData = otpStore.get(emailOrPhone);
    
    if (!storedData) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(emailOrPhone);
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Find user
    const result = await pool.query(
      `SELECT * FROM userz WHERE email = $1 OR phone = $1`,
      [emailOrPhone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE userz SET password = $1 WHERE id = $2',
      [hashedPassword, user.id]
    );

    // Clear OTP
    otpStore.delete(emailOrPhone);

    // Send password changed confirmation email
    try {
      await sendPasswordChangedEmail(user.email, user.full_name);
    } catch (emailError) {
      console.error('❌ Failed to send password changed email:', emailError);
    }

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password (for logged-in users)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId; // Fixed: should be userId from JWT

    // Get user
    const result = await pool.query('SELECT * FROM userz WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE userz SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    // Send password changed confirmation email
    try {
      await sendPasswordChangedEmail(user.email, user.full_name);
    } catch (emailError) {
      console.error('❌ Failed to send password changed email:', emailError);
    }

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};