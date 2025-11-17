import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendWelcomeEmail } from '../services/emailService.js';
import { sendWelcomeWhatsApp } from '../services/whatsappService.js';

// Get all users (for admin)
export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.*,
        p.name as plan_name
       FROM userz u
       LEFT JOIN subscription_planz p ON u.subscription_plan_id = p.id
       ORDER BY u.created_at DESC`
    );

    const users = result.rows.map(user => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      subscriptionPlanId: user.subscription_plan_id,
      subscriptionPlanName: user.plan_name || 'None', // Simple plan name from database
      subscriptionExpiry: user.subscription_expiry,
      createdAt: user.created_at
    }));

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create user (admin only)
export const createUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, role = 'client' } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      `SELECT * FROM userz WHERE email = $1 OR phone = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email or phone already registered' });
    }

    // Validate phone
    if (!/^07\d{8}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone must start with 07 and be 10 digits' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO userz (full_name, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [fullName, email, phone, hashedPassword, role]
    );

    const newUser = result.rows[0];

    // Send welcome notifications (non-blocking)
    try {
      const whatsappLink = sendWelcomeWhatsApp(phone, fullName, email, password);
      await sendWelcomeEmail(email, fullName, password, whatsappLink);
    } catch (notificationError) {
      console.error('Notification sending failed:', notificationError); // Keep error only
    }

    res.status(201).json({
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        subscriptionPlanId: newUser.subscription_plan_id,
        subscriptionExpiry: newUser.subscription_expiry,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, subscriptionPlanId, subscriptionExpiry } = req.body;

    const result = await pool.query(
      `UPDATE userz 
       SET full_name = $1, email = $2, phone = $3, subscription_plan_id = $4, subscription_expiry = $5
       WHERE id = $6 
       RETURNING *`,
      [fullName, email, phone, subscriptionPlanId, subscriptionExpiry, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];

    res.json({
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        subscriptionPlanId: updatedUser.subscription_plan_id,
        subscriptionExpiry: updatedUser.subscription_expiry,
        createdAt: updatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM userz WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};