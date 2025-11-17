import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendWelcomeEmail } from '../services/emailService.js';
import { sendWelcomeWhatsApp } from '../services/whatsappService.js';

export const login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    // Find user by email or phone
    const result = await pool.query(
      `SELECT * FROM userz WHERE email = $1 OR phone = $1`,
      [emailOrPhone]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Handle duplicate emails/phones - try all matching users
    let authenticatedUser = null;
    
    for (const user of result.rows) {
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        authenticatedUser = user;
        break;
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { userId: authenticatedUser.id, role: authenticatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: authenticatedUser.id,
        fullName: authenticatedUser.full_name,
        email: authenticatedUser.email,
        phone: authenticatedUser.phone,
        role: authenticatedUser.role,
        subscriptionPlanId: authenticatedUser.subscription_plan_id,
        subscriptionExpiry: authenticatedUser.subscription_expiry,
        createdAt: authenticatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

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
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with hashed password
    const result = await pool.query(
      `INSERT INTO userz (full_name, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, 'client') 
       RETURNING *`,
      [fullName, email, phone, hashedPassword]
    );

    const newUser = result.rows[0];

    // Send welcome notifications (non-blocking)
  try {
    const whatsappLink = sendWelcomeWhatsApp(phone, fullName, email, password);
    await sendWelcomeEmail(email, fullName, password, whatsappLink);
  } catch (notificationError) {
    console.error('Notification sending failed:', notificationError); // Keep error only
  }

    // Create JWT token
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};