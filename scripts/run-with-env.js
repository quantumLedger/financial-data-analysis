/**
 * Script to load environment variables and run Next.js
 * Usage: node scripts/run-with-env.js [prod|dev]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'dev';
const envFile = mode === 'prod' ? '.env.prod' : '.env.local';
const envPath = path.join(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`❌ ${envFile} not found!`);
  process.exit(1);
}

// Read and parse .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = { ...process.env };

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      envVars[key.trim()] = value;
    }
  }
});

console.log(`✅ Loaded ${envFile} (${mode} mode)`);
console.log(`   Port: 4000`);
console.log(`   Environment: ${envVars.NODE_ENV || (mode === 'prod' ? 'production' : 'development')}`);
console.log(`\n🚀 Starting Next.js...\n`);

// Run next dev with the loaded environment
const nextProcess = spawn('npx', ['next', 'dev', '-p', '4000'], {
  env: envVars,
  stdio: 'inherit',
  shell: true,
});

nextProcess.on('error', (error) => {
  console.error(`❌ Failed to start Next.js:`, error);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  process.exit(code || 0);
});
