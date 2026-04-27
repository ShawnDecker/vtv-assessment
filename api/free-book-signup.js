const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const BASE_URL = process.env.BASE_URL || 'https://assessment.valuetovictory.com';

// CORS allowed origins
const ALLOWED_ORIGINS = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','https://www.shawnedecker.com','http://localhost:3000','http://localhost:5173'];
function getCorsOrigin(req) { const o = req.headers.origin||''; return ALLOWED_ORIGINS.includes(o)?o:o.endsWith('.vercel.app')?o:ALLOWED_ORIGINS[0]; }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body || {};
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS free_book_signups (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ
      )
    `;

    // Check if already verified
    const existing = await sql`
      SELECT id, verified FROM free_book_signups WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
    `;
    if (existing.length > 0 && existing[0].verified) {
      return res.status(200).json({ success: true, message: 'This email has already been verified. Check your inbox for the book download link.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');

    // Upsert: update token if email exists, insert if not
    if (existing.length > 0) {
      await sql`
        UPDATE free_book_signups SET token = ${token}, name = ${name}, created_at = NOW() WHERE email = ${email.toLowerCase()}
      `;
    } else {
      await sql`
        INSERT INTO free_book_signups (email, name, token) VALUES (${email.toLowerCase()}, ${name}, ${token})
      `;
    }

    // Send verification email
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const verifyUrl = `${BASE_URL}/api/verify-email?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Confirm Your Email — Your Free Copy of Running From Miracles is Waiting',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:8px;">VALUE TO VICTORY</div>
              <div style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:#ffffff;">Almost There</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px 32px;">
              <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 16px;">Hey ${escHtml(name)},</p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Thanks for requesting your free copy of <strong style="color:#D4A847;">Running From Miracles</strong> by Shawn Decker.
                We just need to verify your email address before we send it over.
              </p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Click the button below to confirm your email and receive your free digital copy instantly:
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 40px;border-radius:8px;">
                      Confirm My Email &amp; Send My Book
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#71717a;font-size:13px;line-height:1.5;margin:32px 0 0;text-align:center;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${verifyUrl}" style="color:#D4A847;word-break:break-all;">${verifyUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding-top:32px;">
              <p style="color:#52525b;font-size:12px;margin:0;">
                This link expires in 48 hours. If you didn't request this, you can safely ignore this email.
              </p>
              <p style="color:#52525b;font-size:12px;margin:8px 0 0;">
                &copy; 2026 Value to Victory &mdash; Shawn E. Decker
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return res.status(200).json({ success: true, message: 'Verification email sent! Check your inbox.' });

  } catch (err) {
    console.error('free-book-signup error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
