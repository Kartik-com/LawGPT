import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

console.log('=== Environment Variables Check ===');
console.log('FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
console.log('FIREBASE_WEB_API_KEY:', process.env.FIREBASE_WEB_API_KEY ? '✅ Set (length: ' + process.env.FIREBASE_WEB_API_KEY.length + ')' : '❌ Not set');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check if file exists
const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (filePath) {
    const exists = existsSync(filePath);
    console.log('\nFile check for:', filePath);
    console.log('File exists:', exists ? '✅ Yes' : '❌ No');

    // Try different path resolutions
    const paths = [
        filePath,
        './config/firebase-service-account.json',
        'config/firebase-service-account.json',
        './backend/config/firebase-service-account.json'
    ];

    console.log('\nTrying different paths:');
    paths.forEach(p => {
        console.log(`  ${p}: ${existsSync(p) ? '✅' : '❌'}`);
    });
}

// Now try to start the actual server
console.log('\n=== Starting Server ===');
import('./index.js').catch(err => {
    console.error('Failed to start server:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
});
