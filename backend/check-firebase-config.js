#!/usr/bin/env node

/**
 * Firebase Configuration Diagnostic Script
 * This script checks if Firebase is properly configured and can connect
 */

import dotenv from 'dotenv';
import { initializeFirebase, getFirebaseAuth, getFirestore } from './src/config/firebase.js';

dotenv.config();

console.log('🔍 Checking Firebase Configuration...\n');

// Check environment variables
console.log('1. Checking Environment Variables:');
const hasServiceAccountPath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const hasIndividualCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL);

console.log(`   - FIREBASE_SERVICE_ACCOUNT_PATH: ${hasServiceAccountPath ? '✅ Set' : '❌ Not set'}`);
console.log(`   - FIREBASE_SERVICE_ACCOUNT: ${hasServiceAccount ? '✅ Set' : '❌ Not set'}`);
console.log(`   - Individual credentials: ${hasIndividualCreds ? '✅ Set' : '❌ Not set'}`);

if (!hasServiceAccountPath && !hasServiceAccount && !hasIndividualCreds) {
  console.error('\n❌ ERROR: No Firebase configuration found!');
  console.error('   Please set one of:');
  console.error('   - FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json');
  console.error('   - FIREBASE_SERVICE_ACCOUNT={...}');
  console.error('   - FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
  process.exit(1);
}

// Check service account file if path is provided
if (hasServiceAccountPath) {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const serviceAccountPath = path.join(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH.replace('./', ''));
  
  console.log(`\n2. Checking Service Account File: ${serviceAccountPath}`);
  if (fs.existsSync(serviceAccountPath)) {
    console.log('   ✅ File exists');
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log(`   ✅ Valid JSON`);
      console.log(`   - Project ID: ${serviceAccount.project_id || 'N/A'}`);
      console.log(`   - Client Email: ${serviceAccount.client_email || 'N/A'}`);
    } catch (error) {
      console.error(`   ❌ Invalid JSON: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.error(`   ❌ File not found at: ${serviceAccountPath}`);
    process.exit(1);
  }
}

// Try to initialize Firebase
console.log('\n3. Initializing Firebase Admin SDK...');
try {
  initializeFirebase();
  console.log('   ✅ Firebase initialized successfully');
} catch (error) {
  console.error(`   ❌ Failed to initialize Firebase: ${error.message}`);
  console.error(`   Error details:`, error);
  process.exit(1);
}

// Test Firebase Auth
console.log('\n4. Testing Firebase Auth...');
try {
  const auth = getFirebaseAuth();
  console.log('   ✅ Firebase Auth accessible');
  
  // Try to list users (this will fail if permissions are wrong)
  try {
    await auth.listUsers(1);
    console.log('   ✅ Firebase Auth permissions OK');
  } catch (error) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/insufficient-permission') {
      console.error('   ❌ Firebase Auth permissions insufficient');
      console.error('   Make sure your service account has "Firebase Admin SDK Administrator Service Agent" role');
    } else {
      console.log(`   ⚠️  Could not verify permissions: ${error.code}`);
    }
  }
} catch (error) {
  console.error(`   ❌ Firebase Auth error: ${error.message}`);
  process.exit(1);
}

// Test Firestore
console.log('\n5. Testing Firestore...');
try {
  const db = getFirestore();
  console.log('   ✅ Firestore accessible');
  
  // Try to read from a test collection
  try {
    const testRef = db.collection('_test').limit(1);
    await testRef.get();
    console.log('   ✅ Firestore read permissions OK');
  } catch (error) {
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.error('   ❌ Firestore permissions insufficient');
      console.error('   Make sure:');
      console.error('   1. Firestore API is enabled in Google Cloud Console');
      console.error('   2. Your service account has "Cloud Datastore User" role');
      console.error('   3. Firestore database exists and is in Native mode');
    } else if (error.message?.includes('Firestore API')) {
      console.error('   ❌ Firestore API not enabled');
      console.error('   Enable it at: https://console.cloud.google.com/apis/library/firestore.googleapis.com');
    } else {
      console.log(`   ⚠️  Could not verify permissions: ${error.message}`);
    }
  }
  
  // Try to write to a test collection
  try {
    const testRef = db.collection('_test').doc('connection-test');
    await testRef.set({ 
      test: true, 
      timestamp: new Date() 
    });
    await testRef.delete();
    console.log('   ✅ Firestore write permissions OK');
  } catch (error) {
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      console.error('   ❌ Firestore write permissions insufficient');
    } else {
      console.log(`   ⚠️  Could not verify write permissions: ${error.message}`);
    }
  }
} catch (error) {
  console.error(`   ❌ Firestore error: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ All Firebase checks passed!');
console.log('   Your Firebase configuration is correct and ready to use.\n');



