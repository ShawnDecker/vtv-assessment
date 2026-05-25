#!/usr/bin/env node
// Generic customer-recovery script — refund + product fulfillment + audit log.
// Use via vtv-purchase-support skill. Operator must explicitly authorize before running.
//
// Usage:
//   node scripts/recover-customer.js \
//     --pi pi_xxx \
//     --email customer@example.com \
//     --name "Customer Name" \
//     --product rfm-pdf \
//     --reason "Mis-click on $17.77 LOAV button" \
//     --tone faith
//
// Required: --pi, --email
// Optional: --name (default: "Friend"), --product (default: none),
//           --reason (logged to refund metadata), --tone (faith | standard | apology-only),
//           --no-refund (skip refund, just send product), --dry-run (preview without executing)

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = (argv[i+1] && !argv[i+1].startsWith('--')) ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.pi || !args.email) {
  console.error('Usage: --pi pi_xxx --email customer@x --name "Name" --product rfm-pdf --reason "why" --tone faith|standard');
  process.exit(1);
}

const PI = args.pi;
const TO_EMAIL = args.email;
const TO_NAME = args.name || 'Friend';
const FIRST_NAME = TO_NAME.split(' ')[0];
const PRODUCT = args.product || 'none';
const REASON = args.reason || 'Customer recovery';
const TONE = args.tone || 'standard';
const DO_REFUND = !args['no-refund'];
const DRY_RUN = !!args['dry-run'];

const PRODUCTS = {
  'rfm-pdf': {
    file: path.join(__dirname, '..', 'running-from-miracles.pdf'),
    filename: 'Running-From-Miracles-by-Shawn-Decker.pdf',
    contentType: 'application/pdf',
    public_url: 'https://assessment.valuetovictory.com/running-from-miracles.pdf',
    display_name: 'Running From Miracles'
  },
  'none': null
};

const product = PRODUCTS[PRODUCT];
if (PRODUCT !== 'none' && !product) {
  console.error(`Unknown --product "${PRODUCT}". Known: ${Object.keys(PRODUCTS).join(', ')}`);
  process.exit(1);
}

const SIGNOFF_FAITH = `In Christ,\nShawn`;
const SIGNOFF_STANDARD = `Thanks again,\n— Shawn`;
const signoff = TONE === 'faith' ? SIGNOFF_FAITH : SIGNOFF_STANDARD;
const greeting_prefix = TONE === 'faith' ? 'Brother, t' : 'T';

const productLine = product
  ? `\n\n1. Your free copy of ${product.display_name} is attached to this email. You can also download it any time at: ${product.public_url}`
  : '';

const refundLine = DO_REFUND
  ? `\n\n${product ? '2. ' : ''}A full refund has been issued back to the same card. Stripe usually clears it in 5–10 business days.`
  : '';

const TEXT_BODY = `Hi ${FIRST_NAME},

I owe you an apology and a fix.

${REASON}. That's a failure on my end, not yours.${productLine}${refundLine}

${greeting_prefix}hanks for the patience — if anything I can do, just hit reply.

${signoff}

Shawn E. Decker
Founder, Value to Victory
valuetovictory@gmail.com
`;

const HTML_BODY = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f5f0;font-family:Georgia,serif;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:40px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e6e1d6;">
<tr><td style="padding:36px;">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${FIRST_NAME},</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">I owe you an apology and a fix.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">${REASON}. That's a failure on my end, not yours.</p>
${product ? `<p style="font-size:16px;line-height:1.6;margin:16px 0 12px 0;"><strong>1. Your free copy of <em>${product.display_name}</em> — attached.</strong> You can also download it any time at <a href="${product.public_url}" style="color:#7a6312;">${product.public_url.replace('https://','')}</a>.</p>` : ''}
${DO_REFUND ? `<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;"><strong>${product ? '2. ' : ''}Your refund — issued.</strong> Full refund posted back to the same card. Stripe usually clears it in 5–10 business days.</p>` : ''}
<p style="font-size:16px;line-height:1.6;margin:24px 0 16px 0;">${greeting_prefix}hanks for the patience — if there's anything I can do, just hit reply.</p>
<p style="font-size:16px;line-height:1.6;margin:24px 0 4px 0;">${signoff.replace('\n','<br>')}</p>
</td></tr>
<tr><td style="padding:8px 36px 36px 36px;border-top:1px solid #e6e1d6;">
<p style="font-size:13px;line-height:1.5;color:#555;margin:16px 0 0 0;">
<strong>Shawn E. Decker</strong><br>Founder, Value to Victory<br>
<a href="mailto:valuetovictory@gmail.com" style="color:#7a6312;">valuetovictory@gmail.com</a>
</p>
</td></tr></table></td></tr></table></body></html>`;

const SUBJECT = product
  ? `That's on me, ${FIRST_NAME} — your free ${product.display_name}${DO_REFUND ? ' + refund' : ''}`
  : `That's on me, ${FIRST_NAME} — refund issued`;

(async () => {
  const log = { case: REASON, customer_email: TO_EMAIL, customer_name: TO_NAME, payment_intent: PI, product: PRODUCT, tone: TONE, executed_at: new Date().toISOString(), steps: [] };

  if (DRY_RUN) {
    console.log('=== DRY RUN ===');
    console.log('Subject:', SUBJECT);
    console.log('---');
    console.log(TEXT_BODY);
    console.log('---');
    console.log('Would refund:', DO_REFUND ? PI : 'NO');
    console.log('Would attach:', product ? product.file : 'nothing');
    return;
  }

  for (const k of ['STRIPE_SECRET_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    if (!process.env[k]) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
  }

  const Stripe = require('stripe');
  const nodemailer = require('nodemailer');
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  if (DO_REFUND) {
    console.log(`[1/2] Issuing refund for ${PI}...`);
    try {
      const refund = await stripe.refunds.create({
        payment_intent: PI,
        reason: 'requested_by_customer',
        metadata: { recovery_case: REASON.slice(0, 90), customer_email: TO_EMAIL, authorized_by: 'shawn', authorized_at: new Date().toISOString() }
      });
      console.log(`  ✓ Refund: ${refund.id}  status=${refund.status}  amount=$${(refund.amount/100).toFixed(2)}`);
      log.steps.push({ step: 'refund', status: 'ok', id: refund.id, amount: refund.amount, refund_status: refund.status });
    } catch (err) {
      console.error(`  ✗ Refund FAILED: ${err.message}`);
      log.steps.push({ step: 'refund', status: 'fail', error: err.message });
    }
  } else {
    log.steps.push({ step: 'refund', status: 'skipped', reason: '--no-refund flag' });
  }

  console.log(`[2/2] Sending email to ${TO_EMAIL}...`);
  const attachments = [];
  if (product) {
    if (!fs.existsSync(product.file)) {
      console.error(`  ✗ Product file missing: ${product.file}`);
      log.steps.push({ step: 'email', status: 'fail', error: 'product_file_missing' });
    } else {
      attachments.push({ filename: product.filename, path: product.file, contentType: product.contentType });
    }
  }
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    const info = await transporter.sendMail({
      from: `"Shawn E. Decker" <${process.env.GMAIL_USER}>`,
      to: `"${TO_NAME}" <${TO_EMAIL}>`,
      replyTo: process.env.GMAIL_USER,
      subject: SUBJECT,
      text: TEXT_BODY,
      html: HTML_BODY,
      attachments
    });
    console.log(`  ✓ Email sent: ${info.messageId}  accepted=${JSON.stringify(info.accepted)}`);
    log.steps.push({ step: 'email', status: 'ok', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (err) {
    console.error(`  ✗ Email FAILED: ${err.message}`);
    log.steps.push({ step: 'email', status: 'fail', error: err.message });
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(log, null, 2));

  const logDir = path.join(__dirname, '..', '_recovery-logs');
  fs.mkdirSync(logDir, { recursive: true });
  const slug = TO_EMAIL.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const logPath = path.join(logDir, `${slug}-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Audit log: ${logPath}`);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
