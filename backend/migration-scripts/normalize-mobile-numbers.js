/**
 * Migration Script: Normalize Mobile Numbers
 * 
 * This script normalizes phone numbers to 10-digit format (Indian mobile numbers)
 * 
 * Usage:
 *   node migration-scripts/normalize-mobile-numbers.js --dry-run  (preview changes)
 *   node migration-scripts/normalize-mobile-numbers.js --apply    (apply changes)
 */

import 'dotenv/config';
import { initializeFirebase, getFirestore } from '../src/config/firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');

console.log('='.repeat(60));
console.log('MOBILE NUMBER NORMALIZATION MIGRATION');
console.log('='.repeat(60));
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'APPLY (changes will be made)'}`);
console.log('');

// Initialize Firebase using shared config
initializeFirebase();
const db = getFirestore();

/**
 * Normalize phone number to 10 digits
 */
function normalizePhone(phone) {
    if (!phone) return null;

    // Strip all non-numeric characters
    const digits = phone.toString().replace(/\D/g, '');

    // Handle different formats
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return digits; // Already valid
    }

    if (digits.length === 11 && digits.startsWith('0')) {
        // Remove leading 0
        const normalized = digits.substring(1);
        if (/^[6-9]/.test(normalized)) {
            return normalized;
        }
    }

    if (digits.length === 12 && digits.startsWith('91')) {
        // Remove country code
        const normalized = digits.substring(2);
        if (/^[6-9]/.test(normalized)) {
            return normalized;
        }
    }

    if (digits.length === 13 && digits.startsWith('091')) {
        // Remove country code with leading 0
        const normalized = digits.substring(3);
        if (/^[6-9]/.test(normalized)) {
            return normalized;
        }
    }

    // Return null if can't normalize
    return null;
}

/**
 * Check if phone number is valid
 */
function isValidPhone(phone) {
    if (!phone) return false;
    const digits = phone.toString().replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(digits);
}

async function migratePhoneNumbers() {
    try {
        console.log('Fetching all clients and users...\n');

        const clientsSnapshot = await db.collection('clients').get();
        const usersSnapshot = await db.collection('users').get();

        console.log(`Found ${clientsSnapshot.size} clients`);
        console.log(`Found ${usersSnapshot.size} users\n`);

        const clientUpdates = [];
        const userUpdates = [];
        const clientBackup = [];
        const userBackup = [];
        const invalidPhones = [];

        // Process clients
        console.log('Processing clients...');
        clientsSnapshot.forEach((doc, index) => {
            const data = doc.data();
            const originalPhone = data.phone;

            clientBackup.push({
                id: doc.id,
                phone: originalPhone,
                ...data
            });

            if (!originalPhone) {
                console.log(`⚠ [Client ${index + 1}] ${data.name} - No phone number`);
                return;
            }

            if (isValidPhone(originalPhone)) {
                console.log(`✓ [Client ${index + 1}] ${data.name} - ${originalPhone} (valid)`);
            } else {
                const normalized = normalizePhone(originalPhone);

                if (normalized) {
                    console.log(`✗ [Client ${index + 1}] ${data.name} - ${originalPhone} → ${normalized}`);
                    clientUpdates.push({
                        id: doc.id,
                        name: data.name,
                        oldPhone: originalPhone,
                        newPhone: normalized
                    });
                } else {
                    console.log(`✗ [Client ${index + 1}] ${data.name} - ${originalPhone} → INVALID (cannot normalize)`);
                    invalidPhones.push({
                        collection: 'clients',
                        id: doc.id,
                        name: data.name,
                        phone: originalPhone
                    });
                }
            }
        });

        console.log('\nProcessing users...');
        usersSnapshot.forEach((doc, index) => {
            const data = doc.data();
            const originalPhone = data.phone;

            userBackup.push({
                id: doc.id,
                phone: originalPhone,
                ...data
            });

            if (!originalPhone) {
                console.log(`⚠ [User ${index + 1}] ${data.email} - No phone number`);
                return;
            }

            if (isValidPhone(originalPhone)) {
                console.log(`✓ [User ${index + 1}] ${data.email} - ${originalPhone} (valid)`);
            } else {
                const normalized = normalizePhone(originalPhone);

                if (normalized) {
                    console.log(`✗ [User ${index + 1}] ${data.email} - ${originalPhone} → ${normalized}`);
                    userUpdates.push({
                        id: doc.id,
                        email: data.email,
                        oldPhone: originalPhone,
                        newPhone: normalized
                    });
                } else {
                    console.log(`✗ [User ${index + 1}] ${data.email} - ${originalPhone} → INVALID (cannot normalize)`);
                    invalidPhones.push({
                        collection: 'users',
                        id: doc.id,
                        email: data.email,
                        phone: originalPhone
                    });
                }
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total clients: ${clientsSnapshot.size}`);
        console.log(`Clients to update: ${clientUpdates.length}`);
        console.log(`Total users: ${usersSnapshot.size}`);
        console.log(`Users to update: ${userUpdates.length}`);
        console.log(`Invalid phones (manual review needed): ${invalidPhones.length}`);
        console.log('');

        if (invalidPhones.length > 0) {
            console.log('Invalid phone numbers requiring manual review:');
            invalidPhones.forEach(item => {
                console.log(`  - ${item.collection}/${item.id}: ${item.name || item.email} - ${item.phone}`);
            });
            console.log('');
        }

        // Create backup files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const clientBackupPath = path.join(__dirname, `backup-client-phones-${timestamp}.json`);
        const userBackupPath = path.join(__dirname, `backup-user-phones-${timestamp}.json`);
        const invalidPath = path.join(__dirname, `invalid-phones-${timestamp}.json`);

        fs.writeFileSync(clientBackupPath, JSON.stringify(clientBackup, null, 2));
        fs.writeFileSync(userBackupPath, JSON.stringify(userBackup, null, 2));
        if (invalidPhones.length > 0) {
            fs.writeFileSync(invalidPath, JSON.stringify(invalidPhones, null, 2));
        }

        console.log(`Client backup created: ${clientBackupPath}`);
        console.log(`User backup created: ${userBackupPath}`);
        if (invalidPhones.length > 0) {
            console.log(`Invalid phones list: ${invalidPath}`);
        }
        console.log('');

        if (clientUpdates.length === 0 && userUpdates.length === 0) {
            console.log('✓ All phone numbers are already normalized!');
            return;
        }

        if (isDryRun) {
            console.log('DRY RUN MODE - No changes were made');
            console.log('Run with --apply to apply these changes');
        } else {
            console.log('Applying changes...');

            const batch = db.batch();

            clientUpdates.forEach(update => {
                const ref = db.collection('clients').doc(update.id);
                batch.update(ref, {
                    phone: update.newPhone,
                    oldPhone: update.oldPhone,
                    phoneMigrated: true,
                    phoneMigratedAt: new Date().toISOString()
                });
            });

            userUpdates.forEach(update => {
                const ref = db.collection('users').doc(update.id);
                batch.update(ref, {
                    phone: update.newPhone,
                    oldPhone: update.oldPhone,
                    phoneMigrated: true,
                    phoneMigratedAt: new Date().toISOString()
                });
            });

            await batch.commit();
            console.log(`✓ Successfully updated ${clientUpdates.length} client phone numbers`);
            console.log(`✓ Successfully updated ${userUpdates.length} user phone numbers`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migratePhoneNumbers()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
