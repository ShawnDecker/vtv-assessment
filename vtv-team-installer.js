#!/usr/bin/env node
/**
 * Value to Victory — Team Agent Installer
 * Advanced installer with full reporting for terminal users.
 *
 * Usage:
 *   node vtv-team-installer.js
 *   node vtv-team-installer.js --team-id YOUR_TEAM_ID --email admin@company.com
 *
 * What it does:
 *   1. Validates your environment (Node.js version, network)
 *   2. Registers your team with the VTV platform
 *   3. Configures local agent reporting
 *   4. Tests connectivity to all VTV services
 *   5. Generates a status report
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const API_BASE = 'https://assessment.valuetovictory.com';
const VERSION = '1.0.0';

// ── Helpers ──────────────────────────────────────────────────

function log(icon, msg) { console.log(`  ${icon} ${msg}`); }
function ok(msg) { log('[OK]', msg); }
function info(msg) { log('[i]', msg); }
function warn(msg) { log('[!]', msg); }
function err(msg) { log('[X]', msg); }

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`  > ${question}: `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), ms: Date.now() - start });
        } catch {
          resolve({ status: res.statusCode, data, ms: Date.now() - start });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log('  ============================================');
  console.log('   VALUE TO VICTORY — Team Agent Installer');
  console.log(`   v${VERSION}`);
  console.log('  ============================================');
  console.log();

  // Parse CLI args
  const args = process.argv.slice(2);
  let teamId = null, email = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--team-id' && args[i + 1]) teamId = args[++i];
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
  }

  // Step 1: Environment check
  info('Checking environment...');
  const nodeVer = process.version;
  const nodeMajor = parseInt(nodeVer.slice(1));
  if (nodeMajor < 16) {
    err(`Node.js ${nodeVer} is too old. Please upgrade to v16+.`);
    process.exit(1);
  }
  ok(`Node.js ${nodeVer}`);
  ok(`Platform: ${process.platform} ${process.arch}`);
  console.log();

  // Step 2: Connectivity test
  info('Testing VTV platform connectivity...');
  const services = [
    { name: 'API Server', url: `${API_BASE}/api/health` },
    { name: 'Assessment Engine', url: `${API_BASE}/api/questions?email=test@test.com&mode=individual&depth=quick` },
  ];

  const results = [];
  for (const svc of services) {
    try {
      const res = await fetch(svc.url);
      if (res.status === 200) {
        ok(`${svc.name} — ${res.ms}ms`);
        results.push({ ...svc, status: 'healthy', ms: res.ms });
      } else {
        warn(`${svc.name} — HTTP ${res.status}`);
        results.push({ ...svc, status: 'degraded', ms: res.ms });
      }
    } catch (e) {
      err(`${svc.name} — ${e.message}`);
      results.push({ ...svc, status: 'down', ms: 0 });
    }
  }
  console.log();

  // Step 3: Collect team info
  if (!email) email = await ask('Team admin email');
  if (!email) { err('Email is required.'); process.exit(1); }

  if (!teamId) {
    info('Checking for existing team...');
    try {
      const res = await fetch(`${API_BASE}/api/teams?email=${encodeURIComponent(email)}`);
      if (res.status === 200 && res.data && res.data.teams && res.data.teams.length > 0) {
        const team = res.data.teams[0];
        teamId = team.id;
        ok(`Found team: ${team.team_name || team.name} (ID: ${teamId})`);
      }
    } catch {}
  }

  if (!teamId) {
    const teamName = await ask('Team name (e.g., your company)');
    if (!teamName) { err('Team name is required.'); process.exit(1); }
    info(`Creating team "${teamName}"...`);
    try {
      const res = await fetch(`${API_BASE}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, teamName, creatorName: teamName + ' Admin' })
      });
      if (res.status === 200 && res.data.team) {
        teamId = res.data.team.id;
        ok(`Team created! ID: ${teamId}`);
        ok(`Join code: ${res.data.team.join_code}`);
      } else {
        err('Failed to create team: ' + JSON.stringify(res.data));
        process.exit(1);
      }
    } catch (e) {
      err('Network error: ' + e.message);
      process.exit(1);
    }
  }
  console.log();

  // Step 4: Save local config
  const configDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'vtv-agent');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  const config = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    teamId,
    email,
    apiBase: API_BASE,
    dashboardUrl: `${API_BASE}/agent-dashboard`,
    teamReportUrl: `${API_BASE}/team-report/${teamId}`,
    assessmentUrl: `${API_BASE}/?depth=extensive`,
    services: results
  };

  const configPath = path.join(configDir, 'vtv-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  ok(`Config saved: ${configPath}`);
  console.log();

  // Step 5: Download supporting files
  info('Downloading supporting files...');
  const downloads = [
    { name: 'VTV-SYSTEM-ARCHITECTURE.md', desc: 'System Architecture' },
    { name: 'vtv-install.bat', desc: 'Windows Installer (backup)' },
  ];
  for (const dl of downloads) {
    try {
      const filePath = path.join(configDir, dl.name);
      const res = await fetch(`${API_BASE}/${dl.name}`);
      if (res.status === 200) {
        const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        fs.writeFileSync(filePath, content);
        ok(`${dl.desc} → ${filePath}`);
      } else {
        warn(`${dl.desc} — HTTP ${res.status}, skipped`);
      }
    } catch (e) {
      warn(`${dl.desc} — ${e.message}, skipped`);
    }
  }
  console.log();

  // Step 6: Create team assessment link file (easy sharing)
  const linkContent = `Value to Victory — Team Assessment Link\n========================================\n\nShare this link with your team:\n${API_BASE}/?depth=extensive\n\nTeam Report:\n${API_BASE}/team-report/${teamId}\n\nDashboard:\n${API_BASE}/agent-dashboard\n\nCoaching:\nhttps://calendly.com/valuetovictory/30min\n`;
  const linkPath = path.join(configDir, 'TEAM-LINKS.txt');
  fs.writeFileSync(linkPath, linkContent);
  ok(`Team links file: ${linkPath}`);
  console.log();

  // Step 7: Create a simple health check script for the team
  const healthScript = `#!/usr/bin/env node
// VTV Team Health Check — Run anytime: node health-check.js
const https = require('https');
const config = require('./vtv-config.json');
console.log('\\n  VTV Health Check — Team: ' + config.teamId + '\\n');
const checks = [
  { name: 'API', url: config.apiBase + '/api/health' },
  { name: 'Assessment', url: config.apiBase + '/api/questions?email=healthcheck@test.com&mode=individual&depth=quick' },
  { name: 'Team Report', url: config.teamReportUrl },
];
let done = 0;
for (const c of checks) {
  const start = Date.now();
  https.get(c.url, res => {
    const ms = Date.now() - start;
    const icon = res.statusCode === 200 ? '[OK]' : '[!!]';
    console.log('  ' + icon + ' ' + c.name + ' — ' + res.statusCode + ' (' + ms + 'ms)');
    if (++done === checks.length) console.log('');
  }).on('error', e => {
    console.log('  [XX] ' + c.name + ' — ' + e.message);
    if (++done === checks.length) console.log('');
  });
}
`;
  const healthPath = path.join(configDir, 'health-check.js');
  fs.writeFileSync(healthPath, healthScript);
  ok(`Health check script: ${healthPath}`);
  console.log();

  // Step 8: Generate report
  console.log('  ============================================');
  console.log('   SETUP COMPLETE');
  console.log('  ============================================');
  console.log();
  info(`Team ID:       ${teamId}`);
  info(`Admin Email:   ${email}`);
  console.log();
  info('Installed files:');
  info(`  ${configPath}`);
  info(`  ${path.join(configDir, 'VTV-SYSTEM-ARCHITECTURE.md')}`);
  info(`  ${path.join(configDir, 'TEAM-LINKS.txt')}`);
  info(`  ${path.join(configDir, 'health-check.js')}`);
  console.log();
  info('Quick Links:');
  info(`  Dashboard:   ${config.dashboardUrl}`);
  info(`  Team Report: ${config.teamReportUrl}`);
  info(`  Assessment:  ${config.assessmentUrl}`);
  console.log();
  info('Next steps:');
  info('  1. Share the assessment link with your team');
  info('  2. Team members enter the join code when taking the assessment');
  info('  3. View aggregate results on your team report page');
  info('  4. Book a coaching session: https://calendly.com/valuetovictory/30min');
  console.log();
}

main().catch(e => {
  err(`Fatal error: ${e.message}`);
  process.exit(1);
});
