#!/usr/bin/env node
/**
 * VTV Devotional Builder
 * Reads devotional markdown files from an Obsidian vault (or any folder)
 * and builds data/devotionals.json for the daily devotional email system.
 *
 * Obsidian vault structure expected:
 *   vault/devotionals/Day 01 - Introduction.md
 *   vault/devotionals/Day 02 - Looking for God.md
 *   ...
 *
 * Each markdown file format:
 *   ---
 *   day: 1
 *   chapter: 1
 *   chapter_title: Introduction
 *   theme: faith
 *   secondary_theme: family
 *   scripture_reference: Philippians 4:19
 *   scripture_text: And my God will meet all your needs...
 *   ---
 *   ## Reflection
 *   Your reflection text here...
 *
 *   ## Prayer
 *   Your prayer text here...
 *
 *   ## Action Step
 *   Your action step text here...
 *
 *   ## Podcast Topic
 *   Episode idea text...
 *
 *   ## Social Media
 *   Post text...
 *
 * Usage:
 *   node scripts/build-devotionals.js                          # uses default path
 *   node scripts/build-devotionals.js --vault ~/Obsidian/VTV   # custom vault path
 *   node scripts/build-devotionals.js --watch                   # rebuild on file changes
 */

const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
const vaultIdx = args.indexOf('--vault');
const WATCH = args.includes('--watch');

// Default vault paths to search (Windows and Linux)
const DEFAULT_PATHS = [
  path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Obsidian', 'VTV', 'devotionals'),
  path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'Obsidian', 'VTV', 'devotionals'),
  path.join(process.env.USERPROFILE || process.env.HOME || '.', 'OneDrive', 'Obsidian', 'VTV', 'devotionals'),
  path.join(__dirname, '..', 'content', 'devotionals'),
  path.join(__dirname, '..', 'obsidian', 'devotionals'),
];

let vaultPath = vaultIdx > -1 ? args[vaultIdx + 1] : null;
if (!vaultPath) {
  for (const p of DEFAULT_PATHS) {
    if (fs.existsSync(p)) { vaultPath = p; break; }
  }
}

const OUTPUT = path.join(__dirname, '..', 'data', 'devotionals.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      meta[key] = val;
    }
  }
  const body = content.substring(match[0].length).trim();
  return { meta, body };
}

function parseSection(body, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = body.match(re);
  return match ? match[1].trim() : '';
}

function build() {
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    console.log('No Obsidian vault found. Searched:');
    DEFAULT_PATHS.forEach(p => console.log('  -', p));
    if (vaultPath) console.log('  -', vaultPath, '(specified)');
    console.log('\nUsing existing data/devotionals.json (no changes).');
    console.log('To use Obsidian, create devotional markdown files in one of the paths above,');
    console.log('or specify a custom path: node scripts/build-devotionals.js --vault /path/to/vault');
    return false;
  }

  console.log(`Reading devotionals from: ${vaultPath}`);

  const files = fs.readdirSync(vaultPath)
    .filter(f => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('No .md files found in vault. Skipping build.');
    return false;
  }

  const devotionals = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(vaultPath, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);

    const dayNum = parseInt(meta.day) || devotionals.length + 1;
    const entry = {
      day_number: dayNum,
      chapter_number: parseInt(meta.chapter) || dayNum,
      chapter_title: meta.chapter_title || file.replace(/\.md$/, '').replace(/^Day \d+\s*-\s*/, ''),
      title: `Day ${dayNum}: ${meta.chapter_title || file.replace(/\.md$/, '')}`,
      theme: meta.theme || 'faith',
      secondary_theme: meta.secondary_theme || 'family',
      scripture_reference: meta.scripture_reference || '',
      scripture_text: meta.scripture_text || '',
      reflection: parseSection(body, 'Reflection') || body.split('\n\n')[0] || '',
      prayer: parseSection(body, 'Prayer') || '',
      action_step: parseSection(body, 'Action Step') || '',
      podcast_topic: parseSection(body, 'Podcast Topic') || '',
      social_media_post: parseSection(body, 'Social Media') || '',
    };

    devotionals.push(entry);
  }

  // Sort by day number
  devotionals.sort((a, b) => a.day_number - b.day_number);

  // Write output
  fs.writeFileSync(OUTPUT, JSON.stringify(devotionals, null, 2));
  console.log(`Built ${devotionals.length} devotionals → ${OUTPUT}`);
  return true;
}

// Run
build();

if (WATCH && vaultPath && fs.existsSync(vaultPath)) {
  console.log(`\nWatching ${vaultPath} for changes... (Ctrl+C to stop)`);
  let debounce = null;
  fs.watch(vaultPath, { recursive: true }, (event, filename) => {
    if (!filename?.endsWith('.md')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`\n[${new Date().toLocaleTimeString()}] Changed: ${filename}`);
      build();
    }, 500);
  });
}
