const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = new URL('http://x' + req.url).searchParams;
  const token = params.get('token');

  if (!token) {
    return sendPage(res, 400, 'Invalid Link', 'This verification link is invalid or missing a token.');
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Look up the token
    const rows = await sql`
      SELECT id, email, name, verified, created_at FROM free_book_signups WHERE token = ${token} LIMIT 1
    `;

    if (rows.length === 0) {
      return sendPage(res, 404, 'Link Expired or Invalid', 'This verification link is no longer valid. Please request a new one at <a href="https://assessment.valuetovictory.com/free-book" style="color:#D4A847;">our free book page</a>.');
    }

    const signup = rows[0];

    // Check if token is older than 48 hours
    const createdAt = new Date(signup.created_at);
    const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated > 48) {
      return sendPage(res, 410, 'Link Expired', 'This verification link has expired. Please request a new one at <a href="https://assessment.valuetovictory.com/free-book" style="color:#D4A847;">our free book page</a>.');
    }

    // Already verified
    if (signup.verified) {
      return sendPage(res, 200, 'Already Confirmed!', 'Your email has already been confirmed. Check your inbox for the download link. If you can\'t find it, check your spam folder.');
    }

    // Mark as verified
    await sql`
      UPDATE free_book_signups SET verified = TRUE, verified_at = NOW() WHERE id = ${signup.id}
    `;

    // Send the book delivery email
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });

      const downloadUrl = 'https://valuetovictory.com/books/running-from-miracles-digital.pdf';
      const assessmentUrl = 'https://assessment.valuetovictory.com';

      await transporter.sendMail({
        from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
        to: signup.email,
        subject: 'Your Free Copy of Running From Miracles \u{1F4D6}',
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
              <div style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:#ffffff;">Your Book is Ready</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px 32px;">
              <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 16px;">Hey ${signup.name},</p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px;">
                Your email is confirmed. Here's your free digital copy of
                <strong style="color:#D4A847;">Running From Miracles</strong> by Shawn Decker.
              </p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 8px;">
                This isn't just a book. It's a raw, honest look at what happens when you stop running from the
                things that were meant to change your life. Shawn wrote this for the person who feels stuck,
                overlooked, or out of options &mdash; and knows there has to be more.
              </p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Read it. Let it sit. And when you're ready to take the next step, we'll be here.
              </p>
              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 40px;border-radius:8px;">
                      Download My Free Copy
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #27272a;margin:32px 0;" />
              <!-- Assessment CTA -->
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px;">
                <strong style="color:#e4e4e7;">Ready to go deeper?</strong> Take the free P.I.N.K. Value Engine Assessment
                and discover exactly where you're leaking value &mdash; and what to do about it.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${assessmentUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Take the Free Assessment
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding-top:32px;">
              <p style="color:#52525b;font-size:12px;margin:0;">
                You're receiving this because you requested a free copy of Running From Miracles.
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
    }

    // Push to HubSpot if API key is configured
    if (process.env.HUBSPOT_API_KEY) {
      try {
        await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              email: signup.email,
              firstname: signup.name,
              lead_source: 'Free Book - Running From Miracles',
              notes_last_contacted: `Downloaded free copy of Running From Miracles on ${new Date().toISOString().split('T')[0]}`,
            },
          }),
        });
      } catch (hubErr) {
        // Don't fail the verification if HubSpot push fails
        console.error('HubSpot push failed:', hubErr);
      }
    }

    return sendPage(res, 200, 'Email Confirmed!', `
      <p>Your free copy of <strong style="color:#D4A847;">Running From Miracles</strong> is on its way to <strong>${signup.email}</strong>.</p>
      <p style="margin-top:16px;">Check your inbox in the next few minutes. If you don't see it, check your spam or promotions folder.</p>
      <div style="margin-top:32px;">
        <a href="${'https://valuetovictory.com/books/running-from-miracles-digital.pdf'}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:8px;">Download Now</a>
      </div>
      <p style="margin-top:32px;color:#a1a1aa;">While you wait, why not take the free Value Engine Assessment?</p>
      <div style="margin-top:12px;">
        <a href="https://assessment.valuetovictory.com" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 28px;border-radius:8px;">Take the Free Assessment</a>
      </div>
    `);

  } catch (err) {
    console.error('verify-email error:', err);
    return sendPage(res, 500, 'Something Went Wrong', 'We hit a snag verifying your email. Please try again or request a new link at <a href="https://assessment.valuetovictory.com/free-book" style="color:#D4A847;">our free book page</a>.');
  }
};

function sendPage(res, statusCode, title, bodyHtml) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(statusCode).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Value to Victory</title>
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Satoshi', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .container { max-width: 520px; width: 100%; text-align: center; }
    .brand { font-size: 0.7rem; letter-spacing: 3px; text-transform: uppercase; color: #D4A847; margin-bottom: 1rem; }
    h1 { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 2rem; margin-bottom: 1.5rem; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 2.5rem 2rem; text-align: left; }
    .card p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.75rem; }
    .card p:last-child { margin-bottom: 0; }
    a { color: #D4A847; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 2rem; color: #52525b; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">VALUE TO VICTORY</div>
    <h1>${title}</h1>
    <div class="card">${bodyHtml}</div>
    <div class="footer">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</div>
  </div>
</body>
</html>`);
}
