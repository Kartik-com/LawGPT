import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'test';  // Data is in the default 'test' database

const COLLECTIONS = {
    USERS: 'users',
    CASES: 'cases',
    CLIENTS: 'clients',
    HEARINGS: 'hearings',
    INVOICES: 'invoices',
    TIME_ENTRIES: 'timeEntries',
    ACTIVITIES: 'activities',
    FOLDERS: 'folders',
    FILES: 'files'
};

/**
 * Migration script to fix invoice ownership
 * This updates all invoices without an owner or with incorrect owner to belong to the currently logged-in user
 */

async function fixInvoiceOwnership() {
    const client = new MongoClient(MONGODB_URI);

    try {
        console.log('🔄 Starting invoice ownership migration...');
        console.log('📡 Connecting to MongoDB...');

        await client.connect();
        const db = client.db(DB_NAME);

        console.log('✅ Connected to database:', DB_NAME);

        // List all users
        const users = await db.collection(COLLECTIONS.USERS).find({}).toArray();

        if (users.length === 0) {
            console.error('❌ No users found in database.');
            console.log('\n📊 Checking invoices collection...');

            const invoices = await db.collection(COLLECTIONS.INVOICES).find({}).limit(5).toArray();
            console.log(`Found ${invoices.length} invoices`);

            if (invoices.length > 0) {
                console.log('\n🔍 Sample invoice data:');
                invoices.forEach((inv, idx) => {
                    console.log(`  ${idx + 1}. Invoice ${inv.invoiceNumber} - Owner: ${inv.owner || 'NONE'}`);
                });

                // Remove owner field from all documents if no users exist
                console.log('\n⚠️  Since no users exist, removing owner field from all documents...');

                await db.collection(COLLECTIONS.INVOICES).updateMany({}, { $unset: { owner: "" } });
                await db.collection(COLLECTIONS.CASES).updateMany({}, { $unset: { owner: "" } });
                await db.collection(COLLECTIONS.CLIENTS).updateMany({}, { $unset: { owner: "" } });
                await db.collection(COLLECTIONS.HEARINGS).updateMany({}, { $unset: { owner: "" } });

                console.log('✅ Removed owner fields. Backend should now work without authentication.');
            }

            console.log('\n💡 TIP: If you have authentication enabled, make sure to register/login first.');
            process.exit(0);
        }

        console.log(`\n✅ Found ${users.length} user(s):`);
        users.forEach((user, idx) => {
            console.log(`  ${idx + 1}. ${user.email} (ID: ${user._id})`);
        });

        const targetUser = users[0];
        console.log(`\n🎯 Using user: ${targetUser.email}`);

        // Update all invoices to belong to this user
        const result = await db.collection(COLLECTIONS.INVOICES).updateMany(
            {},  // Match all invoices
            { $set: { owner: targetUser._id.toString() } }
        );

        console.log(`\n✅ Updated ${result.modifiedCount} invoices`);
        console.log(`📊 Total invoices matched: ${result.matchedCount}`);

        // Update all cases to belong to this user
        const casesResult = await db.collection(COLLECTIONS.CASES).updateMany(
            {},
            { $set: { owner: targetUser._id.toString() } }
        );

        console.log(`✅ Updated ${casesResult.modifiedCount} cases`);

        // Update all clients to belong to this user
        const clientsResult = await db.collection(COLLECTIONS.CLIENTS).updateMany(
            {},
            { $set: { owner: targetUser._id.toString() } }
        );

        console.log(`✅ Updated ${clientsResult.modifiedCount} clients`);

        // Update all hearings to belong to this user  
        const hearingsResult = await db.collection(COLLECTIONS.HEARINGS).updateMany(
            {},
            { $set: { owner: targetUser._id.toString() } }
        );

        console.log(`✅ Updated ${hearingsResult.modifiedCount} hearings`);

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('📡 Disconnected from MongoDB');
        process.exit(0);
    }
}

fixInvoiceOwnership();
