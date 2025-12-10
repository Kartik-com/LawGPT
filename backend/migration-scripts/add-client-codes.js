/**
 * Migration Script: Add Client Codes
 * 
 * This script generates unique client codes for existing clients
 * Format: {name-slug}-{YYMMDD}-{counter}
 * 
 * Usage:
 *   node migration-scripts/add-client-codes.js --dry-run  (preview changes)
 *   node migration-scripts/add-client-codes.js --apply    (apply changes)
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
console.log('CLIENT CODE GENERATION MIGRATION');
console.log('='.repeat(60));
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'APPLY (changes will be made)'}`);
console.log('');

// Initialize Firebase using shared config
initializeFirebase();
const db = getFirestore();

/**
 * Generate client code from name
 */
function generateClientCode(name, date = new Date(), counter = 1) {
    // Create slug from name
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 20);

    // Format date as YYMMDD
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;

    // Format counter as 3-digit number
    const counterStr = counter.toString().padStart(3, '0');

    return `${slug}-${dateStr}-${counterStr}`;
}

async function addClientCodes() {
    try {
        console.log('Fetching all clients...');
        const clientsSnapshot = await db.collection('clients').get();

        if (clientsSnapshot.empty) {
            console.log('No clients found in database.');
            return;
        }

        console.log(`Found ${clientsSnapshot.size} clients\n`);

        const updates = [];
        const backup = [];
        const usedCodes = new Set();
        let hasCodeCount = 0;
        let needsCodeCount = 0;

        // First pass: collect existing codes
        clientsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.clientCode) {
                usedCodes.add(data.clientCode);
                hasCodeCount++;
            }
        });

        console.log(`Clients with existing codes: ${hasCodeCount}`);
        console.log(`Clients needing codes: ${clientsSnapshot.size - hasCodeCount}\n`);

        // Second pass: generate codes for clients without them
        clientsSnapshot.forEach((doc, index) => {
            const data = doc.data();

            backup.push({
                id: doc.id,
                clientCode: data.clientCode,
                ...data
            });

            if (data.clientCode) {
                console.log(`✓ [${index + 1}] ${data.name} - Already has code: ${data.clientCode}`);
            } else {
                needsCodeCount++;

                // Use createdAt if available, otherwise use current date
                const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

                // Generate unique code
                let clientCode = generateClientCode(data.name, date, 1);
                let counter = 1;

                while (usedCodes.has(clientCode)) {
                    counter++;
                    clientCode = generateClientCode(data.name, date, counter);
                }

                usedCodes.add(clientCode);

                console.log(`✗ [${index + 1}] ${data.name} → ${clientCode}`);

                updates.push({
                    id: doc.id,
                    name: data.name,
                    clientCode
                });
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total clients: ${clientsSnapshot.size}`);
        console.log(`Already have codes: ${hasCodeCount}`);
        console.log(`Need codes: ${needsCodeCount}`);
        console.log('');

        if (updates.length === 0) {
            console.log('✓ All clients already have client codes!');
            return;
        }

        // Create backup file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, `backup-client-codes-${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        console.log(`Backup created: ${backupPath}`);
        console.log('');

        if (isDryRun) {
            console.log('DRY RUN MODE - No changes were made');
            console.log('Run with --apply to apply these changes');
            console.log('\nGenerated codes preview:');
            updates.slice(0, 10).forEach(update => {
                console.log(`  ${update.name}: ${update.clientCode}`);
            });
            if (updates.length > 10) {
                console.log(`  ... and ${updates.length - 10} more`);
            }
        } else {
            console.log('Applying changes...');

            const batch = db.batch();
            updates.forEach(update => {
                const ref = db.collection('clients').doc(update.id);
                batch.update(ref, {
                    clientCode: update.clientCode,
                    clientCodeGenerated: true,
                    clientCodeGeneratedAt: new Date().toISOString()
                });
            });

            await batch.commit();
            console.log(`✓ Successfully generated ${updates.length} client codes`);
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
addClientCodes()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
