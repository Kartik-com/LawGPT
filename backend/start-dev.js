import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Checking port 5000...');

try {
    // Try to kill any process on port 5000
    await execAsync('FOR /F "tokens=5" %P IN (\'netstat -ano ^| findstr :5000 ^| findstr LISTENING\') DO taskkill /F /PID %P').catch(() => { });
    console.log('✅ Port 5000 is ready');
} catch (e) {
    // Port was already free
}

// Small delay to ensure port is free
await new Promise(resolve => setTimeout(resolve, 500));

// Start the server with nodemon
console.log('🚀 Starting server with auto-restart...\n');
const serverProcess = exec('nodemon --env-file=.env index.js');

// Pipe output to parent process
serverProcess.stdout.pipe(process.stdout);
serverProcess.stderr.pipe(process.stderr);

// Forward signals to child process
process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
});
