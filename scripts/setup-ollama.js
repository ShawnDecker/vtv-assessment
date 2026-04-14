#!/usr/bin/env node
/**
 * VTV Assessment — Ollama Local AI Setup (Cross-Platform)
 * Works on Windows, Mac, and Linux.
 *
 * Usage:
 *   npm run setup:ollama
 *   node scripts/setup-ollama.js
 */

const { execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch { return null; }
}

async function main() {
  console.log('');
  console.log('  +----------------------------------------------+');
  console.log('  |   VTV Assessment — Ollama Local AI Setup      |');
  console.log('  +----------------------------------------------+');
  console.log('');

  // Check if Ollama is installed
  const ollamaVersion = run('ollama --version');
  if (!ollamaVersion) {
    console.log('  [ERROR] Ollama is not installed.\n');
    console.log('  Install from: https://ollama.ai/download\n');
    if (process.platform === 'win32') {
      console.log('  Windows: Download the installer from https://ollama.ai/download');
    } else if (process.platform === 'darwin') {
      console.log('  macOS:   brew install ollama');
    } else {
      console.log('  Linux:   curl -fsSL https://ollama.com/install.sh | sh');
    }
    console.log('');
    process.exit(1);
  }

  console.log(`  [OK] Ollama installed: ${ollamaVersion}`);

  // Check if Ollama server is running
  let serverRunning = false;
  try {
    const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    serverRunning = resp.ok;
  } catch {}

  if (!serverRunning) {
    console.log('  [INFO] Ollama server not running. Starting it...');
    console.log('  [INFO] If this hangs, open a separate terminal and run: ollama serve');
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    child.unref();
    // Wait for server to start
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        if (resp.ok) { serverRunning = true; break; }
      } catch {}
    }
    if (!serverRunning) {
      console.log('  [WARN] Could not start Ollama server automatically.');
      console.log('  Please run "ollama serve" in another terminal, then re-run this script.');
      process.exit(1);
    }
  }

  console.log('  [OK] Ollama server is running\n');

  // Detect RAM
  const totalRamGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  console.log(`  [INFO] Detected RAM: ${totalRamGB}GB`);
  console.log(`  [INFO] Platform: ${process.platform} (${os.arch()})\n`);

  // Select models based on RAM
  let models = [];
  let envSettings = {};

  if (totalRamGB >= 16) {
    console.log('  [INFO] 16GB+ RAM — Installing full model set\n');
    models = ['llama3.1:8b', 'mistral:7b'];
    envSettings = {
      AI_PROVIDER: 'local',
      LOCAL_MODEL_COACHING: 'llama3.1:8b',
      LOCAL_MODEL_SUMMARY: 'mistral:7b',
      LOCAL_MODEL_EMAIL: 'mistral:7b',
      LOCAL_MODEL_CONTENT: 'llama3.1:8b',
      LOCAL_MODEL_DEVOTIONAL: 'llama3.1:8b',
    };
  } else if (totalRamGB >= 8) {
    console.log('  [INFO] 8GB RAM — Installing lightweight models\n');
    models = ['phi3:mini', 'mistral:7b'];
    envSettings = {
      AI_PROVIDER: 'local',
      LOCAL_MODEL_COACHING: 'phi3:mini',
      LOCAL_MODEL_SUMMARY: 'phi3:mini',
      LOCAL_MODEL_EMAIL: 'mistral:7b',
      LOCAL_MODEL_CONTENT: 'phi3:mini',
      LOCAL_MODEL_DEVOTIONAL: 'phi3:mini',
    };
  } else {
    console.log('  [WARN] Less than 8GB RAM — Installing smallest model only\n');
    models = ['phi3:mini'];
    envSettings = {
      AI_PROVIDER: 'auto',
      LOCAL_MODEL_COACHING: 'phi3:mini',
      LOCAL_MODEL_SUMMARY: 'phi3:mini',
      LOCAL_MODEL_EMAIL: 'phi3:mini',
      LOCAL_MODEL_CONTENT: 'phi3:mini',
      LOCAL_MODEL_DEVOTIONAL: 'phi3:mini',
    };
  }

  // Pull models
  for (const model of models) {
    console.log(`  [${model}] Pulling (this may take a few minutes)...`);
    try {
      execSync(`ollama pull ${model}`, { stdio: 'inherit' });
      console.log(`  [${model}] Ready\n`);
    } catch (err) {
      console.log(`  [${model}] FAILED: ${err.message}\n`);
    }
  }

  // Generate .env if it doesn't exist
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log('  [INFO] Creating .env from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('  [OK] .env created — fill in your values\n');
  }

  // Append/update AI settings in .env
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    let updated = false;
    for (const [key, value] of Object.entries(envSettings)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      updated = true;
    }
    if (updated) {
      fs.writeFileSync(envPath, envContent);
      console.log('  [OK] .env updated with AI settings\n');
    }
  }

  // Show results
  console.log('  +----------------------------------------------+');
  console.log('  |              Setup Complete!                  |');
  console.log('  +----------------------------------------------+\n');

  // List installed models
  const listOutput = run('ollama list');
  if (listOutput) {
    console.log('  Installed models:');
    console.log('  ' + listOutput.split('\n').join('\n  '));
    console.log('');
  }

  console.log('  To start VTV with local AI:');
  console.log('    npm run dev:local-ai\n');
  console.log('  To use auto-mode (local first, cloud fallback):');
  console.log('    npm run dev:auto\n');
  console.log('  Recommended .env settings for your system:');
  for (const [key, value] of Object.entries(envSettings)) {
    console.log(`    ${key}=${value}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
