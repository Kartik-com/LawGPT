import dotenv from 'dotenv';
dotenv.config();

console.log('Environment check:');
console.log('FIREBASE_WEB_API_KEY:', process.env.FIREBASE_WEB_API_KEY ? '✅ Set' : '❌ Not set');
console.log('FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

try {
  const { initializeFirebase } = await import('./src/config/firebase.js');
  initializeFirebase();
  console.log('✅ Firebase initialized successfully!');
  
  const { ensureFirebaseWebApiKey } = await import('./src/utils/env.js');
  const key = ensureFirebaseWebApiKey({ requireInProduction: true });
  console.log('✅ Firebase Web API Key validated!');
  
  console.log('\n🎉 All checks passed! Backend should start successfully.');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
