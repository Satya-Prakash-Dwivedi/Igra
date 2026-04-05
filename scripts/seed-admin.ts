/**
 * seed-admin.ts — One-time script to create an admin user in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * The script reads credentials from environment variables:
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 * Or falls back to safe defaults for local development.
 */
import connectDB from '../server/config/db.ts';
import User from '../server/models/User.ts';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

async function seedAdmin() {
    await connectDB();

    const name     = process.env.ADMIN_NAME     || 'Igra Admin';
    const email    = process.env.ADMIN_EMAIL    || 'admin@igrastudios.com';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';

    // Check if an admin with this email already exists
    const existing = await User.findOne({ email });
    if (existing) {
        console.log(`\n⚠️  A user with email "${email}" already exists.`);
        console.log(`   Role: ${existing.role}`);
        if (existing.role !== 'admin') {
            existing.role = 'admin';
            await existing.save();
            console.log('   ✅ Role updated to "admin".');
        } else {
            console.log('   ✅ Already an admin. Nothing to do.');
        }
        process.exit(0);
    }

    // Create the admin user
    // NOTE: The pre-save hook in User.ts automatically bcrypt-hashes the password.
    const admin = await User.create({
        name,
        email,
        password,
        role: 'admin',
        isVerified: true,
        isActive: true,
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('─'.repeat(40));
    console.log(`  ID:    ${admin._id}`);
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log('─'.repeat(40));
    console.log('\n👉 You can now log in via POST /api/v1/auth/login');
    console.log('   with the email and password above.\n');

    process.exit(0);
}

seedAdmin().catch((err) => {
    console.error('\n❌ Seed script failed:', err.message);
    process.exit(1);
});
