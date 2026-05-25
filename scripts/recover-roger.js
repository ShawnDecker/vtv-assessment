#!/usr/bin/env node
// One-shot customer recovery: Roger Bodenstab — LOAV mis-click.
// 1. Refund $17.77 against pi_3TUHHJCaTyuNk1Mc0dK5tQcH
// 2. Email RFM PDF + apology
//
// Authorized by Shawn 2026-05-06 ("refund and send the book")

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const REQUIRED = ['STRIPE_SECRET_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
for (const k of REQUIRED) {
  if (!process.env[k]) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}

const Stripe = require('stripe');
const nodemailer = require('nodemailer');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PI = 'pi_3TUHHJCaTyuNk1Mc0dK5tQcH';
const TO_EMAIL = 'roger@ccfoursquare.org';
const TO_NAME = 'Roger Bodenstab';
const PDF_PATH = path.join(__dirname, '..', 'running-from-miracles.pdf');

const SUBJECT = "That's on me, Pastor Roger — your free Running From Miracles + refund";

const TEXT_BODY = `Hi Roger,

I owe you an apology and a fix.

You came in for the free copy of Running From Miracles and instead got charged $17.77 for the pre-order of The Lost Art of Value — a different book of mine that's still being finished. The two buttons sit right next to each other on my page and the layout is too easy to mis-tap. That's a UI failure on my side, not yours. I'm fixing the page tonight so the next person doesn't hit the same wall.

Two things from me:

1. Your free book — attached. Running From Miracles PDF is on this email. You can also grab it any time at: https://assessment.valuetovictory.com/running-from-miracles.pdf

2. Your $17.77 — refunded. Full refund issued back to the same card. Stripe usually clears it in 5–10 business days. If after reading the PDF you'd actually like to be on the LOAV pre-order list (it's a leadership/value-creation book, releasing later this year), just reply "keep me on the list" — otherwise you're fully off the hook.

Brother, thanks for the patience. If anything in Running From Miracles lands for you or your church family, I'd love to hear about it — reply any time.

In Christ,
Shawn

Shawn E. Decker
Author, Running From Miracles
Founder, Value to Victory
valuetovictory@gmail.com
`;

const HTML_BODY = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f5f0;font-family:Georgia,serif;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:40px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e6e1d6;">
<tr><td style="padding:36px 36px 8px 36px;">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi Roger,</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">I owe you an apology and a fix.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">You came in for the <strong>free</strong> copy of <em>Running From Miracles</em> and instead got charged <strong>$17.77</strong> for the pre-order of <em>The Lost Art of Value</em> — a different book of mine that's still being finished. The two buttons sit right next to each other on my page and the layout is too easy to mis-tap. That's a UI failure on my side, not yours. I'm fixing the page tonight so the next person doesn't hit the same wall.</p>
<p style="font-size:16px;line-height:1.6;margin:24px 0 8px 0;"><strong>Two things from me:</strong></p>
<p style="font-size:16px;line-height:1.6;margin:0 0 12px 0;"><strong>1. Your free book — attached.</strong> <em>Running From Miracles</em> PDF is on this email. You can also grab it any time at: <a href="https://assessment.valuetovictory.com/running-from-miracles.pdf" style="color:#7a6312;">assessment.valuetovictory.com/running-from-miracles.pdf</a></p>
<p style="font-size:16px;line-height:1.6;margin:0 0 12px 0;"><strong>2. Your $17.77 — refunded.</strong> Full refund issued back to the same card. Stripe usually clears it in 5–10 business days. If after reading the PDF you'd actually <em>like</em> to be on the LOAV pre-order list (it's a leadership/value-creation book, releasing later this year), just reply "keep me on the list" — otherwise you're fully off the hook.</p>
<p style="font-size:16px;line-height:1.6;margin:24px 0 16px 0;">Brother, thanks for the patience. If anything in <em>Running From Miracles</em> lands for you or your church family, I'd love to hear about it — reply any time.</p>
<p style="font-size:16px;line-height:1.6;margin:24px 0 4px 0;">In Christ,<br>Shawn</p>
</td></tr>
<tr><td style="padding:8px 36px 36px 36px;border-top:1px solid #e6e1d6;margin-top:24px;">
<p style="font-size:13px;line-height:1.5;color:#555;margin:16px 0 0 0;">
<strong>Shawn E. Decker</strong><br>
Author, <em>Running From Miracles</em><br>
Founder, Value to Victory<br>
<a href="mailto:valuetovictory@gmail.com" style="color:#7a6312;">valuetovictory@gmail.com</a>
</p>
</td></tr></table></td></tr></table></body></html>`;

(async () => {
  const log = { steps: [] };

  // STEP 1: Refund
  console.log(`[1/2] Issuing refund for ${PI}...`);
  try {
    const refund = await stripe.refunds.create({
      payment_intent: PI,
      reason: 'requested_by_customer',
      metadata: {
        recovery_case: 'loav-misclick-roger-bodenstab',
        authorized_by: 'shawn',
        authorized_at: new Date().toISOString()
      }
    });
    console.log(`  ✓ Refund created: ${refund.id}  status=${refund.status}  amount=$${(refund.amount/100).toFixed(2)}`);
    log.steps.push({ step: 'refund', status: 'ok', id: refund.id, amount: refund.amount, refund_status: refund.status });
  } catch (err) {
    console.error(`  ✗ Refund FAILED: ${err.message}`);
    log.steps.push({ step: 'refund', status: 'fail', error: err.message });
    // Do not abort — we still want to deliver the book even if refund fails
  }

  // STEP 2: Email PDF
  console.log(`[2/2] Sending RFM PDF to ${TO_EMAIL}...`);
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`  ✗ PDF missing at ${PDF_PATH}`);
    log.steps.push({ step: 'email', status: 'fail', error: 'pdf_missing' });
  } else {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      });
      const info = await transporter.sendMail({
        from: `"Shawn E. Decker" <${process.env.GMAIL_USER}>`,
        to: `"${TO_NAME}" <${TO_EMAIL}>`,
        replyTo: process.env.GMAIL_USER,
        subject: SUBJECT,
        text: TEXT_BODY,
        html: HTML_BODY,
        attachments: [{
          filename: 'Running-From-Miracles-by-Shawn-Decker.pdf',
          path: PDF_PATH,
          contentType: 'application/pdf'
        }]
      });
      console.log(`  ✓ Email sent: ${info.messageId}`);
      console.log(`    accepted: ${JSON.stringify(info.accepted)}`);
      console.log(`    rejected: ${JSON.stringify(info.rejected)}`);
      log.steps.push({ step: 'email', status: 'ok', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
    } catch (err) {
      console.error(`  ✗ Email FAILED: ${err.message}`);
      log.steps.push({ step: 'email', status: 'fail', error: err.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(log, null, 2));

  // Persist a recovery log for the audit trail
  const logDir = path.join(__dirname, '..', '_recovery-logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `roger-bodenstab-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    case: 'loav-misclick-roger-bodenstab',
    customer_email: TO_EMAIL,
    customer_name: TO_NAME,
    payment_intent: PI,
    executed_at: new Date().toISOString(),
    ...log
  }, null, 2));
  console.log(`\nAudit log: ${logPath}`);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
