#!/usr/bin/env node
/**
 * Value to Victory — Team Agent Installer v2.0
 * Upgrade-safe: detects existing installs, preserves user files,
 * only upgrades VTV-managed components.
 *
 * Usage:
 *   node vtv-team-installer.js
 *   node vtv-team-installer.js --team-id YOUR_TEAM_ID --email admin@company.com
 *
 * Upgrade behavior:
 *   - Detects previous installations via vtv-config.json
 *   - Backs up user-modified files before touching anything
 *   - Only overwrites VTV-managed files (health-check.js, TEAM-LINKS.txt)
 *   - Merges config: preserves user fields, upgrades VTV fields
 *   - Skills: upgrades VTV skill, never touches user-created skills
 *   - Reports upgrade event to platform for tracking
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const API_BASE = 'https://assessment.valuetovictory.com';
const VERSION = '2.0.0';

// Files managed by VTV that are safe to upgrade
const VTV_MANAGED_FILES = [
  'health-check.js',
  'TEAM-LINKS.txt',
  'VTV-SYSTEM-ARCHITECTURE.md',
  'vtv-install.bat',
];

// Files we NEVER overwrite — they contain user data
const USER_OWNED_FILES = [
  'vtv-config.json',  // merged, not replaced
];

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

function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch { return null; }
}

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(dir, `${base}.backup-${ts}${ext}`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// ── Upgrade Detection ───────────────────────────────────────

function detectExistingInstall(configDir) {
  const configPath = path.join(configDir, 'vtv-config.json');
  const existing = safeReadJSON(configPath);
  if (!existing) return null;

  // Inventory what's on disk
  const inventory = {};
  try {
    const files = fs.readdirSync(configDir);
    for (const f of files) {
      const fp = path.join(configDir, f);
      const stat = fs.statSync(fp);
      inventory[f] = {
        size: stat.size,
        modified: stat.mtime.toISOString(),
        hash: stat.isFile() ? fileHash(fp) : null,
        isDir: stat.isDirectory()
      };
    }
  } catch {}

  return {
    version: existing.version || '1.0.0',
    installedAt: existing.installedAt,
    email: existing.email,
    teamId: existing.teamId,
    config: existing,
    inventory,
    configPath
  };
}

function detectExistingSkills() {
  const skillsBase = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'skills');
  const result = { vtvSkill: null, userSkills: [] };

  if (!fs.existsSync(skillsBase)) return result;

  try {
    const dirs = fs.readdirSync(skillsBase);
    for (const d of dirs) {
      const skillPath = path.join(skillsBase, d, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf8');
        const isVTV = content.includes('Value to Victory') || d === 'vtv-team';
        if (isVTV) {
          result.vtvSkill = { dir: d, path: skillPath, hash: fileHash(skillPath) };
        } else {
          result.userSkills.push({ dir: d, path: skillPath });
        }
      }
    }
  } catch {}

  return result;
}

function detectClaudeMem() {
  const memDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude-mem');
  const pluginDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'plugins', 'marketplaces', 'thedotmack');
  return {
    database: fs.existsSync(memDir),
    plugin: fs.existsSync(pluginDir),
    databasePath: memDir,
    pluginPath: pluginDir
  };
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

  // ── Step 1: Detect existing installation ──────────────────
  const configDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'vtv-agent');
  const existing = detectExistingInstall(configDir);
  const existingSkills = detectExistingSkills();
  const existingMem = detectClaudeMem();
  let isUpgrade = false;
  let upgradeLog = [];

  if (existing) {
    isUpgrade = true;
    console.log('  ┌──────────────────────────────────────────┐');
    console.log('  │  EXISTING INSTALLATION DETECTED          │');
    console.log('  └──────────────────────────────────────────┘');
    console.log();
    info(`Previous version: v${existing.version}`);
    info(`Installed: ${existing.installedAt}`);
    info(`Email: ${existing.email}`);
    info(`Team ID: ${existing.teamId}`);
    if (existing.inventory) {
      const fileCount = Object.keys(existing.inventory).filter(k => !existing.inventory[k].isDir).length;
      info(`Files on disk: ${fileCount}`);
    }
    if (existingSkills.vtvSkill) {
      info(`VTV Skill: installed at ${existingSkills.vtvSkill.dir}/`);
    }
    if (existingSkills.userSkills.length > 0) {
      info(`User skills found: ${existingSkills.userSkills.map(s => s.dir).join(', ')}`);
      ok('User skills will NOT be modified');
    }
    if (existingMem.database) {
      info('Claude-Mem database: found');
      ok('Memory database will NOT be modified');
    }
    console.log();
    info('UPGRADE MODE — preserving your files, upgrading VTV components');
    upgradeLog.push(`Detected v${existing.version} → v${VERSION}`);

    // Carry forward email and teamId from existing install
    if (!email) email = existing.email;
    if (!teamId) teamId = existing.teamId;
  } else {
    info('No previous installation found — fresh install');
  }
  console.log();

  // ── Step 2: Environment check ─────────────────────────────
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

  // ── Step 3: Connectivity test ─────────────────────────────
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

  // ── Step 4: Collect team info ─────────────────────────────
  if (!email) email = await ask('Team admin email');
  if (!email) { err('Email is required.'); process.exit(1); }

  if (!teamId || teamId === 'pending') {
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

  if (!teamId || teamId === 'pending') {
    const teamName = await ask('Team name (e.g., your company)');
    info(`Registering "${teamName || 'VTV Team'}"...`);
    try {
      const res = await fetch(`${API_BASE}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, teamName: teamName || 'VTV Team', creatorName: (teamName || 'VTV') + ' Admin' })
      });
      if (res.status === 200 && res.data && res.data.team) {
        teamId = res.data.team.id;
        ok(`Team created! ID: ${teamId}`);
      } else {
        warn('Team registration skipped (create one later in the portal)');
        teamId = 'pending';
      }
    } catch (e) {
      warn('Team registration skipped — will set up later');
      teamId = 'pending';
    }
  }
  console.log();

  // ── Step 5: Create backup directory (upgrades only) ───────
  let backupDir = null;
  if (isUpgrade) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    backupDir = path.join(configDir, `backups`, `pre-upgrade-${ts}`);
    fs.mkdirSync(backupDir, { recursive: true });
    info(`Backup directory: ${backupDir}`);
    upgradeLog.push(`Backup dir: ${backupDir}`);
  }

  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  // ── Step 6: Merge config (never overwrite) ────────────────
  info(isUpgrade ? 'Merging configuration...' : 'Creating configuration...');

  const newConfig = {
    version: VERSION,
    installedAt: existing ? existing.installedAt : new Date().toISOString(),
    lastUpgrade: isUpgrade ? new Date().toISOString() : null,
    upgradeHistory: [],
    teamId,
    email,
    apiBase: API_BASE,
    dashboardUrl: `${API_BASE}/agent-dashboard`,
    teamReportUrl: `${API_BASE}/team-report/${teamId}`,
    assessmentUrl: `${API_BASE}/?depth=extensive`,
    services: results
  };

  const configPath = path.join(configDir, 'vtv-config.json');

  if (existing) {
    // Back up current config
    const bk = path.join(backupDir, 'vtv-config.json');
    fs.copyFileSync(configPath, bk);
    ok(`Config backed up → ${path.basename(backupDir)}/vtv-config.json`);

    // Merge: keep any user-added fields, update VTV fields
    const merged = { ...existing.config, ...newConfig };

    // Preserve user's custom fields that aren't in our template
    for (const key of Object.keys(existing.config)) {
      if (!(key in newConfig)) {
        merged[key] = existing.config[key];
      }
    }

    // Build upgrade history
    merged.upgradeHistory = existing.config.upgradeHistory || [];
    merged.upgradeHistory.push({
      from: existing.version,
      to: VERSION,
      date: new Date().toISOString(),
      filesBackedUp: Object.keys(existing.inventory || {}).length
    });

    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
    ok(`Config merged (preserved ${Object.keys(existing.config).length} existing fields)`);
    upgradeLog.push('Config: merged');
  } else {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    ok(`Config saved: ${configPath}`);
  }
  console.log();

  // ── Step 7: Upgrade VTV-managed files ─────────────────────
  info(isUpgrade ? 'Upgrading VTV-managed files...' : 'Downloading supporting files...');

  const downloads = [
    { name: 'VTV-SYSTEM-ARCHITECTURE.md', desc: 'System Architecture', managed: true },
    { name: 'vtv-install.bat', desc: 'Windows Installer (backup)', managed: true },
  ];

  for (const dl of downloads) {
    try {
      const filePath = path.join(configDir, dl.name);
      const existsAlready = fs.existsSync(filePath);

      if (isUpgrade && existsAlready && dl.managed) {
        // Back up before overwriting managed files
        const bk = path.join(backupDir, dl.name);
        fs.copyFileSync(filePath, bk);
      }

      const res = await fetch(`${API_BASE}/${dl.name}`);
      if (res.status === 200) {
        const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        fs.writeFileSync(filePath, content);
        ok(`${dl.desc} ${existsAlready ? '(upgraded)' : '(new)'}`);
        if (isUpgrade && existsAlready) upgradeLog.push(`${dl.name}: upgraded`);
      } else {
        warn(`${dl.desc} — HTTP ${res.status}, skipped`);
      }
    } catch (e) {
      warn(`${dl.desc} — ${e.message}, skipped`);
    }
  }
  console.log();

  // ── Step 8: Create/upgrade team links ─────────────────────
  const linkPath = path.join(configDir, 'TEAM-LINKS.txt');
  if (isUpgrade && fs.existsSync(linkPath)) {
    const bk = path.join(backupDir, 'TEAM-LINKS.txt');
    fs.copyFileSync(linkPath, bk);
  }
  const linkContent = `Value to Victory — Team Assessment Link\n========================================\n\nShare this link with your team:\n${API_BASE}/?depth=extensive\n\nTeam Report:\n${API_BASE}/team-report/${teamId}\n\nDashboard:\n${API_BASE}/agent-dashboard\n\nCoaching:\nhttps://calendly.com/valuetovictory/30min\n`;
  fs.writeFileSync(linkPath, linkContent);
  ok(`Team links ${isUpgrade ? '(upgraded)' : '(created)'}`);

  // ── Step 9: Create/upgrade health check ───────────────────
  const healthPath = path.join(configDir, 'health-check.js');
  if (isUpgrade && fs.existsSync(healthPath)) {
    const bk = path.join(backupDir, 'health-check.js');
    fs.copyFileSync(healthPath, bk);
  }
  const healthScript = `#!/usr/bin/env node
// VTV Team Health Check v${VERSION} — Run anytime: node health-check.js
const https = require('https');
const config = require('./vtv-config.json');
console.log('\\n  VTV Health Check — Team: ' + config.teamId + ' (v' + config.version + ')\\n');
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
  fs.writeFileSync(healthPath, healthScript);
  ok(`Health check ${isUpgrade ? '(upgraded)' : '(created)'}`);
  console.log();

  // ── Step 10: Upgrade VTV skill (preserve user skills) ─────
  info(isUpgrade ? 'Checking skills...' : 'Skills will be installed by the .bat wrapper');

  if (existingSkills.userSkills.length > 0) {
    for (const us of existingSkills.userSkills) {
      ok(`User skill "${us.dir}" — preserved (not touched)`);
    }
  }

  // Upgrade the VTV skill if it exists
  const skillsBase = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'skills');
  const vtvSkillDir = path.join(skillsBase, 'vtv-team');
  const vtvSkillPath = path.join(vtvSkillDir, 'SKILL.md');

  if (existingSkills.vtvSkill) {
    // Back up current VTV skill before upgrading
    if (backupDir) {
      const skillBackupDir = path.join(backupDir, 'skills');
      fs.mkdirSync(skillBackupDir, { recursive: true });
      fs.copyFileSync(existingSkills.vtvSkill.path, path.join(skillBackupDir, 'SKILL.md'));
      ok('VTV skill backed up');
    }

    // Download latest VTV skill
    try {
      const res = await fetch(`${API_BASE}/vtv-team-skill.md`);
      if (res.status === 200) {
        const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        const oldHash = existingSkills.vtvSkill.hash;
        fs.writeFileSync(existingSkills.vtvSkill.path, content);
        const newHash = fileHash(existingSkills.vtvSkill.path);
        if (oldHash !== newHash) {
          ok('VTV skill upgraded to latest version');
          upgradeLog.push('VTV skill: upgraded');
        } else {
          ok('VTV skill already up to date');
          upgradeLog.push('VTV skill: already current');
        }
      }
    } catch (e) {
      warn(`Could not upgrade VTV skill: ${e.message}`);
    }
  } else {
    // Fresh install — create skill directory and download
    try {
      if (!fs.existsSync(vtvSkillDir)) fs.mkdirSync(vtvSkillDir, { recursive: true });
      const res = await fetch(`${API_BASE}/vtv-team-skill.md`);
      if (res.status === 200) {
        const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        fs.writeFileSync(vtvSkillPath, content);
        ok('VTV skill installed — use /vtv-team in Claude Code');
      }
    } catch (e) {
      warn(`Skill install skipped: ${e.message}`);
    }
  }

  // Scan for any other skills in the user's .claude directory and list them
  try {
    if (fs.existsSync(skillsBase)) {
      const allSkills = fs.readdirSync(skillsBase).filter(d => {
        return fs.existsSync(path.join(skillsBase, d, 'SKILL.md'));
      });
      if (allSkills.length > 0) {
        info(`Total skills installed: ${allSkills.length} (${allSkills.join(', ')})`);
      }
    }
  } catch {}
  console.log();

  // ── Step 11: Scan for user's custom files to preserve ─────
  if (isUpgrade) {
    info('Scanning for user-created files...');
    try {
      const allFiles = fs.readdirSync(configDir);
      const userFiles = allFiles.filter(f => {
        // Not a VTV-managed file, not a backup, not a directory
        if (VTV_MANAGED_FILES.includes(f)) return false;
        if (USER_OWNED_FILES.includes(f)) return false;
        if (f.includes('.backup-')) return false;
        if (f === 'backups') return false;
        if (f === 'vtv-team-installer.js') return false;
        const fp = path.join(configDir, f);
        return fs.statSync(fp).isFile();
      });
      if (userFiles.length > 0) {
        ok(`Found ${userFiles.length} user file(s) — all preserved:`);
        for (const uf of userFiles) {
          info(`  → ${uf}`);
        }
      } else {
        ok('No additional user files found');
      }
    } catch {}
    console.log();
  }

  // ── Step 12: Report installation to VTV platform ──────────
  info(`Registering ${isUpgrade ? 'upgrade' : 'installation'}...`);
  try {
    const os = require('os');
    const installData = {
      system_name: `team:${email.split('@')[0]}`,
      system_type: 'installation',
      category: 'team',
      status: 'complete',
      metadata: {
        email,
        team_id: teamId,
        hostname: os.hostname(),
        os: `${os.platform()} ${os.release()}`,
        node_version: process.version,
        ram_gb: Math.round(os.totalmem() / 1073741824 * 10) / 10,
        cpu_cores: os.cpus().length,
        disk_free_gb: 'unknown',
        installed_at: existing ? existing.installedAt : new Date().toISOString(),
        upgraded_at: isUpgrade ? new Date().toISOString() : null,
        installer_version: VERSION,
        previous_version: existing ? existing.version : null,
        is_upgrade: isUpgrade,
        claude_mem: existingMem.database || existingMem.plugin,
        skills_count: (existingSkills.userSkills.length + (existingSkills.vtvSkill ? 1 : 0)),
        user_skills: existingSkills.userSkills.map(s => s.dir),
        upgrade_log: upgradeLog,
        files_backed_up: isUpgrade ? fs.readdirSync(backupDir).length : 0,
        steps: results.map(r => `${r.status === 'healthy' ? 'pass' : 'fail'}:${r.name}`)
      }
    };
    const machineData = {
      system_name: `team:${email.split('@')[0]}`,
      system_type: 'resource',
      category: 'team',
      status: 'healthy',
      metadata: {
        hostname: os.hostname(),
        os: `${os.platform()} ${os.arch()} ${os.release()}`,
        ram_gb: Math.round(os.totalmem() / 1073741824 * 10) / 10,
        cpu_cores: os.cpus().length,
        cpu_model: os.cpus()[0]?.model || 'unknown',
        username: os.userInfo().username
      }
    };
    await fetch(`${API_BASE}/api/agent/systems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systems: [installData, machineData] })
    });
    ok(`${isUpgrade ? 'Upgrade' : 'Installation'} registered`);
  } catch (e) {
    warn('Could not register (non-critical)');
  }
  console.log();

  // ── Step 13: Final report ─────────────────────────────────
  console.log('  ============================================');
  console.log(`   ${isUpgrade ? 'UPGRADE' : 'SETUP'} COMPLETE — v${VERSION}`);
  console.log('  ============================================');
  console.log();
  info(`Team ID:       ${teamId}`);
  info(`Admin Email:   ${email}`);
  if (isUpgrade) {
    info(`Upgraded from: v${existing.version}`);
    info(`Files backed up to: ${path.basename(backupDir)}/`);
  }
  console.log();

  if (isUpgrade && upgradeLog.length > 0) {
    info('What changed:');
    for (const entry of upgradeLog) {
      info(`  → ${entry}`);
    }
    console.log();
    info('What was preserved:');
    info('  → Your config (merged, not replaced)');
    info('  → Your Claude-Mem data & memories');
    info('  → Your custom skills');
    info('  → All user-created files');
    console.log();
  }

  info('Quick Links:');
  info(`  Dashboard:   ${API_BASE}/agent-dashboard`);
  info(`  Team Report: ${API_BASE}/team-report/${teamId}`);
  info(`  Assessment:  ${API_BASE}/?depth=extensive`);
  console.log();
  info('Next steps:');
  if (isUpgrade) {
    info('  1. Open Claude Code — your /vtv-team skill is updated');
    info('  2. Your memories and custom work are untouched');
    info('  3. Run "node health-check.js" to verify everything');
  } else {
    info('  1. Open Claude Code and type /vtv-team');
    info('  2. Share the assessment link with your team');
    info('  3. Book a coaching session: https://calendly.com/valuetovictory/30min');
  }
  console.log();
}

main().catch(e => {
  err(`Fatal error: ${e.message}`);
  process.exit(1);
});
