#!/usr/bin/env node
/**
 * VTV Local System Agent
 * Collects Docker container status + Ollama model status from the local machine
 * and POSTs to the VTV assessment API system registry.
 *
 * Usage:
 *   node scripts/system-agent.js                  # one-shot report
 *   node scripts/system-agent.js --loop           # continuous (every 5 min)
 *   node scripts/system-agent.js --loop --interval 60  # every 60 seconds
 *
 * Env: ADMIN_API_KEY (or reads from .env / Vercel env)
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE || 'https://assessment.valuetovictory.com';
const API_KEY = process.env.ADMIN_API_KEY || process.env.VTV_ADMIN_KEY || '';
const LOOP = process.argv.includes('--loop');
const INTERVAL_IDX = process.argv.indexOf('--interval');
const INTERVAL_SEC = INTERVAL_IDX > -1 ? parseInt(process.argv[INTERVAL_IDX + 1]) || 300 : 300;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (e) {
    return null;
  }
}

function getDockerContainers() {
  const raw = run('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}"');
  if (!raw) return [];

  return raw.split('\n').filter(Boolean).map(line => {
    const [name, statusRaw, ports, image] = line.split('|');
    let status = 'unknown';
    const sl = (statusRaw || '').toLowerCase();
    if (sl.includes('up') && sl.includes('healthy')) status = 'healthy';
    else if (sl.includes('up') && sl.includes('unhealthy')) status = 'unhealthy';
    else if (sl.includes('restarting')) status = 'restarting';
    else if (sl.includes('up')) status = 'running';
    else if (sl.includes('exited')) status = 'exited';
    else if (sl.includes('created')) status = 'created';

    return {
      name: `docker:${name}`,
      type: 'docker',
      category: 'docker',
      endpoint: ports ? ports.split(',')[0].trim() : null,
      status,
      metadata: {
        image: image || '',
        ports: ports || '',
        uptime: statusRaw || ''
      }
    };
  });
}

function getOllamaModels() {
  const raw = run('curl -s http://localhost:11434/api/tags');
  if (!raw) return [{ name: 'ollama:service', type: 'ollama', category: 'ollama', status: 'down', metadata: { error: 'Not responding' } }];

  try {
    const data = JSON.parse(raw);
    const models = (data.models || []).map(m => ({
      name: `ollama:${m.name}`,
      type: 'ollama',
      category: 'ollama',
      status: 'available',
      metadata: {
        size: (m.size / 1e9).toFixed(1) + 'GB',
        parameters: m.details?.parameter_size || '',
        quantization: m.details?.quantization_level || '',
        family: m.details?.family || '',
        modified: m.modified_at || ''
      }
    }));

    // Check if any model is currently loaded
    const psRaw = run('curl -s http://localhost:11434/api/ps');
    if (psRaw) {
      try {
        const ps = JSON.parse(psRaw);
        for (const running of (ps.models || [])) {
          const match = models.find(m => m.name === `ollama:${running.name}`);
          if (match) match.status = 'loaded';
        }
      } catch (e) {}
    }

    // Add Ollama service entry
    models.unshift({
      name: 'ollama:service',
      type: 'ollama',
      category: 'ollama',
      endpoint: 'http://localhost:11434',
      status: 'running',
      metadata: { model_count: models.length }
    });

    return models;
  } catch (e) {
    return [{ name: 'ollama:service', type: 'ollama', category: 'ollama', status: 'degraded', metadata: { error: e.message } }];
  }
}

function getLocalServices() {
  const services = [];

  // Check local n8n (Docker)
  const n8nUp = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz');
  services.push({
    name: 'local:n8n',
    type: 'service',
    category: 'local',
    endpoint: 'http://localhost:5678',
    status: n8nUp === '200' ? 'running' : 'down',
    metadata: { check: 'healthz' }
  });

  // System resources
  const memRaw = run('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value');
  if (memRaw) {
    const free = parseInt((memRaw.match(/FreePhysicalMemory=(\d+)/) || [])[1]) || 0;
    const total = parseInt((memRaw.match(/TotalVisibleMemorySize=(\d+)/) || [])[1]) || 0;
    const usedPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
    services.push({
      name: 'system:memory',
      type: 'resource',
      category: 'local',
      status: usedPct > 90 ? 'degraded' : 'healthy',
      metadata: {
        used_pct: usedPct + '%',
        free_gb: (free / 1048576).toFixed(1) + 'GB',
        total_gb: (total / 1048576).toFixed(1) + 'GB'
      }
    });
  }

  // Disk space
  const diskRaw = run('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /Value');
  if (diskRaw) {
    const freeB = parseInt((diskRaw.match(/FreeSpace=(\d+)/) || [])[1]) || 0;
    const totalB = parseInt((diskRaw.match(/Size=(\d+)/) || [])[1]) || 0;
    const usedPct = totalB > 0 ? Math.round(((totalB - freeB) / totalB) * 100) : 0;
    services.push({
      name: 'system:disk-c',
      type: 'resource',
      category: 'local',
      status: usedPct > 90 ? 'degraded' : 'healthy',
      metadata: {
        used_pct: usedPct + '%',
        free_gb: (freeB / 1073741824).toFixed(0) + 'GB',
        total_gb: (totalB / 1073741824).toFixed(0) + 'GB'
      }
    });
  }

  // ffmpeg
  const ffmpegVer = run('ffmpeg -version');
  if (ffmpegVer) {
    const ver = (ffmpegVer.match(/ffmpeg version ([^\s]+)/) || [])[1] || 'unknown';
    services.push({
      name: 'local:ffmpeg',
      type: 'tool',
      category: 'local',
      status: 'available',
      metadata: { version: ver, capabilities: 'video editing, transcoding, clipping, subtitles, audio' }
    });
  }

  // BiaBox Video Engine (port 8003)
  const videoUp = run('curl -s http://localhost:8003/');
  if (videoUp) {
    try {
      const vd = JSON.parse(videoUp);
      services.push({
        name: 'local:video-engine',
        type: 'service',
        category: 'local',
        endpoint: 'http://localhost:8003',
        status: vd.status === 'running' ? 'running' : 'degraded',
        metadata: { version: vd.version || '', module: vd.module || 'video_engine' }
      });
    } catch (e) {}
  }

  // ComfyUI (port 8188)
  const comfyUp = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8188/');
  services.push({
    name: 'local:comfyui',
    type: 'service',
    category: 'local',
    endpoint: 'http://localhost:8188',
    status: comfyUp === '200' || comfyUp === '302' ? 'running' : 'down',
    metadata: { type: 'AI image/video generation', runtime: 'cpu-only' }
  });

  return services;
}

function postReport(systems) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ systems });
    const url = new URL(`${API_BASE}/api/agent/systems/report`);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function collect() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Collecting system status...`);

  const docker = getDockerContainers();
  const ollama = getOllamaModels();
  const local = getLocalServices();

  const all = [...docker, ...ollama, ...local];
  console.log(`  Docker: ${docker.length} containers`);
  console.log(`  Ollama: ${ollama.length} entries`);
  console.log(`  Local:  ${local.length} services`);

  try {
    const result = await postReport(all);
    console.log(`  Reported ${result.updated} systems to API`);
  } catch (err) {
    console.error(`  Failed to report: ${err.message}`);
  }
}

async function main() {
  if (!API_KEY) {
    console.warn('Warning: No ADMIN_API_KEY set. API calls may fail.');
  }

  await collect();

  if (LOOP) {
    console.log(`\nLooping every ${INTERVAL_SEC}s. Press Ctrl+C to stop.\n`);
    setInterval(collect, INTERVAL_SEC * 1000);
  }
}

main().catch(console.error);
