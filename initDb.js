import initDatabase from './utils/initDatabase.js';

async function initialize() {
  try {
    console.log('🚀 Starting database initialization...');
    await initDatabase();
    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initialize();