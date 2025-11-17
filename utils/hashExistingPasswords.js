import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

async function hashExistingPasswords() {
  try {
    // Get all users with plain text passwords
    const result = await pool.query('SELECT id, password FROM userz');
    
    for (const user of result.rows) {
      // Skip if already hashed (bcrypt hashes start with $2b$)
      if (user.password.startsWith('$2b$')) continue;
      
      // Hash the plain text password
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      // Update user with hashed password
      await pool.query('UPDATE userz SET password = $1 WHERE id = $2', [
        hashedPassword, 
        user.id
      ]);
    }
  } catch (error) {
    console.error('❌ Error hashing passwords:', error);
  }
}

// Run this once
hashExistingPasswords();