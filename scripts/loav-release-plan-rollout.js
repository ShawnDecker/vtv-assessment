#!/usr/bin/env node
// LOAV release plan rollout — 2026-05-11
//   A. Update Stripe LOAV product description + metadata with release-plan language
//   B. Update cart-row + reference mentions across vtv-assessment/*.html
//   C. Report all edits + Stripe diff
//
// Source of truth: ValueToVictory/13-Books/LOAV/RELEASE-PLAN.md
//   Release: 2026-12-01 · digital-only first 5,000 copies · print after · presale $17.77
//
// Idempotent: re-running detects existing release-plan strings and skips.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const LOAV_PRICE_ID = 'price_1TGJKpCaTyuNk1McinmAOTNR';   // $17.77 presale
const REPO_ROOT = path.join(__dirname, '..');

// --------- A. STRIPE UPDATE ---------
async function updateStripe() {
  console.log('--- A. Stripe LOAV product update ---');
  const price = await stripe.prices.retrieve(LOAV_PRICE_ID, { expand: ['product'] });
  const product = price.product;
  console.log(`Product: ${product.id} · "${product.name}"`);
  console.log(`Current description: ${product.description || '(none)'}`);

  const newDescription = `The Lost Art of Value: Time for P.I.N.K. — digital presale. Releases December 1, 2026. Digital-only for the first 5,000 copies; a print edition will follow after the 5,000-copy threshold is reached. Presale buyers receive the finished digital edition on release day. Authored by Shawn E. Decker.`;

  const newMetadata = {
    ...(product.metadata || {}),
    release_date: '2026-12-01',
    launch_format: 'digital_only',
    print_threshold: '5000',
    presale_price: '17.77',
    manuscript_version: 'v4',
    manuscript_committed: '2026-05-11',
    release_plan_doc: 'ValueToVictory/13-Books/LOAV/RELEASE-PLAN.md',
  };

  if (product.description === newDescription) {
    console.log('  description already matches release plan — skip');
  } else {
    await stripe.products.update(product.id, {
      description: newDescription,
      metadata: newMetadata,
    });
    console.log(`  ✔ product ${product.id} description + metadata updated`);
  }

  // Update price nickname too
  if (price.nickname !== 'LOAV Presale · Digital · Dec 1 2026 · $17.77') {
    await stripe.prices.update(LOAV_PRICE_ID, {
      nickname: 'LOAV Presale · Digital · Dec 1 2026 · $17.77',
      metadata: { release_date: '2026-12-01', launch_format: 'digital_only', print_threshold: '5000' },
    });
    console.log(`  ✔ price ${LOAV_PRICE_ID} nickname updated`);
  } else {
    console.log('  price nickname already correct — skip');
  }
}

// --------- B. HTML CART-ROW UPDATE ---------
// Three patterns to upgrade:
//  P1 (cart row, hex gold): <span><strong style="color:#D4A847;">$17.77</strong> The Lost Art of Value</span>
//  P2 (cart row, var gold): <strong style="color:var(--gold)">$17.77 paid</strong> The Lost Art of Value (forthcoming)
//  P3 (cart row, var gold): <strong style="color:var(--gold)">$17.77</strong> The Lost Art of Value
const HTML_PATTERNS = [
  {
    name: 'P1 hex-gold cart row',
    find: '<span><strong style="color:#D4A847;">$17.77</strong> The Lost Art of Value</span>',
    replace: '<span><strong style="color:#D4A847;">$17.77</strong> The Lost Art of Value <em style="opacity:.75;font-weight:normal;">(digital presale · ships Dec 1, 2026)</em></span>'
  },
  {
    name: 'P2 var-gold "paid" forthcoming',
    find: '<strong style="color:var(--gold)">$17.77 paid</strong> The Lost Art of Value (forthcoming)',
    replace: '<strong style="color:var(--gold)">$17.77</strong> The Lost Art of Value <em style="opacity:.75;font-weight:normal;">(digital presale · ships Dec 1, 2026)</em>'
  },
  {
    name: 'P3 var-gold cart row',
    find: '<strong style="color:var(--gold)">$17.77</strong> The Lost Art of Value',
    replace: '<strong style="color:var(--gold)">$17.77</strong> The Lost Art of Value <em style="opacity:.75;font-weight:normal;">(digital presale · ships Dec 1, 2026)</em>'
  },
];

function updateHtml() {
  console.log('\n--- B. HTML cart-row + reference update ---');
  const files = fs.readdirSync(REPO_ROOT).filter(f => f.endsWith('.html'));
  let totalEdits = 0;
  for (const f of files) {
    const fp = path.join(REPO_ROOT, f);
    let src = fs.readFileSync(fp, 'utf8');
    let edits = 0;
    // Hard guard: if a release-marker em-tag already follows ANY $17.77 LOAV row in the file,
    // assume this file has been processed and skip every pattern.
    const PROCESSED_MARKER = /\$17\.77<\/strong> The Lost Art of Value <em[^>]*>\(digital presale · ships Dec 1, 2026\)<\/em>/;
    if (PROCESSED_MARKER.test(src)) {
      continue; // file already updated this run or previous run
    }
    for (const p of HTML_PATTERNS) {
      const re = new RegExp(p.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const newSrc = src.replace(re, p.replace);
      if (newSrc !== src) {
        const count = (src.match(re) || []).length;
        edits += count;
        src = newSrc;
        break; // one pattern per file is enough — prevents P2-then-P3 double-tap
      }
    }
    if (edits > 0) {
      fs.writeFileSync(fp, src);
      console.log(`  ✔ ${f}: ${edits} edit(s)`);
      totalEdits += edits;
    }
  }
  console.log(`Total HTML edits: ${totalEdits}`);
}

(async () => {
  await updateStripe();
  updateHtml();
  console.log('\n========== DONE ==========');
  console.log('\nNot updated this run (still needs separate work):');
  console.log('  - valuetovictory.com cart page (valuetovictory-site repo not local — pull via `vercel pull` separately)');
  console.log('  - millioncopybookgiveaway.com/loav-book-mockup.png — image hosting; out of scope here');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
