const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const authHeader = req.headers['authorization'] || '';
  const apiKey = authHeader.replace('Bearer ', '');
  if (!process.env.SEND_EMAIL_API_KEY || apiKey !== process.env.SEND_EMAIL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, subject, html, text } = req.body || {};

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, and html or text' });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const result = await transporter.sendMail({
      from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    });

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
};
