import bcryptjs from 'bcryptjs';
import pool from './config/database.js';

async function createAdminUser() {
  try {
    const plainPassword = "Government@1976";
    const hashedPassword = await bcryptjs.hash(plainPassword, 12);

    const query = `
      INSERT INTO userz (full_name, email, phone, password, role) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        password = EXCLUDED.password,
        role = EXCLUDED.role
      RETURNING id, full_name, email, role
    `;

    const values = [
      'Ssentongo Ronald',
      'ssentongoronald256@gmail.com', 
      '0783650857',
      hashedPassword,
      'admin'
    ];

    const result = await pool.query(query, values);
    console.log('✅ Admin user created/updated successfully:');
    console.log('ID:', result.rows[0].id);
    console.log('Name:', result.rows[0].full_name);
    console.log('Email:', result.rows[0].email);
    console.log('Role:', result.rows[0].role);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();