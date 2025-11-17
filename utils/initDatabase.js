import pool from '../config/database.js';

async function initDatabase() {
  try {
    // Drop and create subscription_planz FIRST
    await pool.query('DROP TABLE IF EXISTS subscription_planz CASCADE');

    await pool.query(`
      CREATE TABLE subscription_planz (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'UGX',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // userz table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS userz (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('admin', 'agent', 'client')) DEFAULT 'client',
        subscription_plan_id INTEGER,
        subscription_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create paymentz table (REMOVED duration_days column)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paymentz (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES userz(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES subscription_planz(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'UGX',
        transaction_token VARCHAR(255) UNIQUE NOT NULL,
        company_ref VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        provider VARCHAR(50),
        phone_number VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Create moviez table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moviez (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) CHECK (category IN ('local', 'english')) NOT NULL,
        thumbnail_url VARCHAR(500),
        file_key VARCHAR(500) NOT NULL,
        file_size BIGINT,
        subscription_plan_ids INTEGER[] DEFAULT '{}',
        uploaded_by INTEGER REFERENCES userz(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        downloads_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Create downloadz table for tracking downloads
    await pool.query(`
      CREATE TABLE IF NOT EXISTS downloadz (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES userz(id) ON DELETE CASCADE,
        movie_id INTEGER NOT NULL REFERENCES moviez(id) ON DELETE CASCADE,
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, movie_id)
      )
    `);


    // Create upload_sessions table for resume capability
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        id SERIAL PRIMARY KEY,
        file_key VARCHAR(500) UNIQUE NOT NULL,
        upload_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        user_id INTEGER REFERENCES userz(id),
        status VARCHAR(50) DEFAULT 'uploading',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        uploaded_parts JSONB DEFAULT '[]'
      )
    `);

    // Add file_type column to moviez table if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'moviez' AND column_name = 'file_type') THEN
          ALTER TABLE moviez ADD COLUMN file_type VARCHAR(100);
        END IF;
      END $$;
    `);

    // Update upload_sessions table for better resume tracking
    await pool.query(`
      ALTER TABLE upload_sessions 
      ADD COLUMN IF NOT EXISTS uploaded_chunks INTEGER[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // Convert subscription_plan_id to INTEGER if needed
    const columnCheck = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'userz' AND column_name = 'subscription_plan_id'
    `);

    if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'character varying') {
      
      await pool.query(`
        ALTER TABLE userz 
        DROP CONSTRAINT IF EXISTS fk_subscription_plan
      `);
      
      await pool.query(`
        ALTER TABLE userz 
        ALTER COLUMN subscription_plan_id TYPE INTEGER 
        USING CASE 
          WHEN subscription_plan_id ~ '^[0-9]+$' THEN subscription_plan_id::integer 
          ELSE NULL 
        END
      `);
      
      await pool.query(`
        ALTER TABLE userz 
        ADD CONSTRAINT fk_subscription_plan 
        FOREIGN KEY (subscription_plan_id) 
        REFERENCES subscription_planz(id) ON DELETE SET NULL
      `);
      
    } else {
    }
    
  } catch (error) {
    console.error('❌ Error creating database:', error);
  }
}

export default initDatabase;