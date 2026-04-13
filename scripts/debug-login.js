const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const r = await sql`SELECT id, first_name, email, pin_hash, pin_set_at FROM contacts WHERE LOWER(email) = 'thepowerofvalue@gmail.com' LIMIT 1`;
  console.log('Contact:', JSON.stringify(r[0], null, 2));

  const salt = process.env.PIN_SALT || '_vtv_salt_2026';
  const pins = ['1234','0000','1111','2024','2025','2026','4321','7777','1776','0001','9999','5555','1212','3333'];
  for (const pin of pins) {
    const hash = crypto.createHash('sha256').update(pin + salt).digest('hex');
    if (hash === r[0].pin_hash) {
      console.log('PIN MATCH:', pin);
    }
  }

  const a = await sql`SELECT id, mode, depth, master_score FROM assessments WHERE contact_id = ${r[0].id} ORDER BY id DESC LIMIT 3`;
  console.log('Assessments:', JSON.stringify(a));

  const dp = await sql`SELECT id, display_name FROM dating_profiles WHERE contact_id = ${r[0].id} LIMIT 1`;
  console.log('Dating profile:', JSON.stringify(dp));
})();
