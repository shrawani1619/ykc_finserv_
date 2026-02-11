import Bank from '../models/bank.model.js';
import BankManager from '../models/bankManager.model.js';

/**
 * Seed a sample bank and a sample bank manager (only if none exist).
 * Safe to call on server start.
 */
export const seedSampleBankAndManager = async () => {
  try {
    const existingBanks = await Bank.countDocuments();
    if (existingBanks === 0) {
      const bank = await Bank.create({
        name: 'Test Bank',
        type: 'bank',
        contactEmail: 'testbank@example.com',
        contactPerson: 'Test Contact',
        contactMobile: '9000000000',
        status: 'active',
      });
      console.log('✅ Seeded sample bank:', bank.name);

      // Create a sample bank manager linked to this bank
      const existingBM = await BankManager.findOne({ email: 'testbm@example.com' });
      if (!existingBM) {
        const bm = await BankManager.create({
          name: 'Test Bank Manager',
          email: 'testbm@example.com',
          mobile: '9000000001',
          role: 'bm',
          bank: bank._id,
          status: 'active',
        });
        console.log('✅ Seeded sample bank manager:', bm.name);
      } else {
        console.log('ℹ️ Sample bank manager already exists, skipping creation.');
      }
    } else {
      // If banks exist, ensure at least one bank manager exists
      const bmCount = await BankManager.countDocuments();
      if (bmCount === 0) {
        const bank = await Bank.findOne().lean();
        if (bank) {
          const bm = await BankManager.create({
            name: 'Test Bank Manager',
            email: 'testbm@example.com',
            mobile: '9000000001',
            role: 'bm',
            bank: bank._id,
            status: 'active',
          });
          console.log('✅ Seeded sample bank manager linked to existing bank:', bm.name);
        }
      } else {
        console.log('ℹ️ Banks and bank managers already present, skipping seeding.');
      }
    }
  } catch (error) {
    console.error('❌ Error seeding bank or bank manager:', error.message);
  }
};

