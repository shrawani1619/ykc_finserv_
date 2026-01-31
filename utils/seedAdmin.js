import User from '../models/user.model.js';

/**
 * Create default admin user if it doesn't exist
 */
export const seedDefaultAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      console.log('✅ Default admin user already exists');
      return;
    }

    // Create default admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@gmail.com',
      mobile: '9999999999', // Default mobile number
      password: 'admin@123', // Plain text password (as per User model)
      role: 'super_admin',
      status: 'active',
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Default Admin User Created Successfully!');
    console.log('='.repeat(60));
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: admin@123');
    console.log('👤 Role: super_admin');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Error creating default admin user:', error.message);
    // Don't exit process, just log the error
  }
};
