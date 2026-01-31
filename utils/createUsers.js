import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Franchise from '../models/franchise.model.js';
import connectDB from '../config/db.js';

/**
 * Create users for all roles except super_admin
 */
const createUsers = async () => {
  try {
    // Connect to database
    await connectDB();

    // Create a default franchise for agents and franchise owners
    let defaultFranchise = await Franchise.findOne({ name: 'Default Franchise' });
    
    if (!defaultFranchise) {
      defaultFranchise = await Franchise.create({
        name: 'Default Franchise',
        ownerName: 'Default Owner',
        email: 'franchise@ykc.com',
        mobile: '8888888888',
        status: 'active',
      });
      console.log('✅ Created default franchise');
    }

    // Define users to create (excluding super_admin)
    const usersToCreate = [
      {
        name: 'Relationship Manager',
        email: 'officestaff@ykc.com',
        mobile: '1111111111',
        password: 'staff@123',
        role: 'relationship_manager',
      },
      {
        name: 'Franchise Manager',
        email: 'franchisemanager@ykc.com',
        mobile: '2222222222',
        password: 'franchisemanager@123',
        role: 'franchise_manager',
      },
      {
        name: 'Franchise Owner',
        email: 'franchiseowner@ykc.com',
        mobile: '3333333333',
        password: 'franchiseowner@123',
        role: 'franchise_owner',
        franchise: defaultFranchise._id,
        franchiseOwned: defaultFranchise._id,
      },
      {
        name: 'Agent',
        email: 'agent@ykc.com',
        mobile: '4444444444',
        password: 'agent@123',
        role: 'agent',
        franchise: defaultFranchise._id,
      },
      {
        name: 'Accounts Manager',
        email: 'accountsmanager@ykc.com',
        mobile: '5555555555',
        password: 'accountsmanager@123',
        role: 'accounts_manager',
      },
    ];

    console.log('\n' + '='.repeat(60));
    console.log('🚀 Creating Users...');
    console.log('='.repeat(60) + '\n');

    const createdUsers = [];
    const skippedUsers = [];

    for (const userData of usersToCreate) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          skippedUsers.push({
            ...userData,
            reason: 'Already exists',
          });
          console.log(`⏭️  Skipped: ${userData.name} (${userData.email}) - Already exists`);
          continue;
        }

        // Create user
        const user = await User.create(userData);
        createdUsers.push(user);
        
        console.log(`✅ Created: ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Password: ${userData.password}`);
        console.log(`   👤 Role: ${user.role}`);
        console.log(`   📱 Mobile: ${user.mobile}`);
        console.log('');
      } catch (error) {
        console.error(`❌ Error creating ${userData.name}:`, error.message);
      }
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${createdUsers.length} users`);
    console.log(`⏭️  Skipped: ${skippedUsers.length} users`);
    console.log('='.repeat(60) + '\n');

    if (createdUsers.length > 0) {
      console.log('📋 Created Users:');
      createdUsers.forEach(user => {
        const userData = usersToCreate.find(u => u.email === user.email);
        console.log(`   • ${user.name} (${user.email}) - Password: ${userData.password}`);
      });
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating users:', error.message);
    process.exit(1);
  }
};

createUsers();
