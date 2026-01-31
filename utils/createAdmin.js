import mongoose from 'mongoose';
import User from '../models/user.model.js';
import connectDB from '../config/db.js';

/**
 * Create admin user
 */
const createAdmin = async () => {
  try {
    // Connect to database
    await connectDB();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  Admin user already exists!');
      console.log('='.repeat(60));
      console.log('📧 Email: admin@gmail.com');
      console.log('👤 Role: super_admin');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@gmail.com',
      mobile: '9999999999',
      password: 'admin@123',
      role: 'super_admin',
      status: 'active',
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Admin User Created Successfully!');
    console.log('='.repeat(60));
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: admin@123');
    console.log('👤 Role: super_admin');
    console.log('📱 Mobile: 9999999999');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  }
};

createAdmin();
