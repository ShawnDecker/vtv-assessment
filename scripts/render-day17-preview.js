#!/usr/bin/env node
// Render-only preview of Day-17 coaching email with the new LOAV citation.
// No DB, no Stripe, no send — just shows the body string a real recipient would see.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));

// Read the source, extract Day-17 case body, eval just enough to render it
const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'index.js'), 'utf8');

// Build a self-contained eval sandbox: the helper + a fake generator that only handles day=17
const helperMatch = src.match(/const LOAV_PRESALE_URL[\s\S]*?function loavCitation[\s\S]*?\n\}/);
if (!helperMatch) { console.error('Could not locate loavCitation helper'); process.exit(1); }
const day17Match = src.match(/case 17:[\s\S]*?break;/);
if (!day17Match) { console.error('Could not locate case 17 block'); process.exit(1); }

const sandbox = `
${helperMatch[0]}

function renderDay17(opts) {
  const firstName = opts.firstName;
  const masterScore = opts.masterScore;
  const weakest = opts.weakest;
  const weakestScore = opts.weakestScore;
  let subject, body;
  const day = 17;
  switch(day) {
    ${day17Match[0]}
  }
  return { subject, body };
}

const out = renderDay17({ firstName: 'Roger', masterScore: 142, weakest: 'Numbers', weakestScore: 18 });
console.log('SUBJECT:', out.subject);
console.log('');
console.log('---- BODY ----');
console.log(out.body);
console.log('---- END ----');
`;

eval(sandbox);
