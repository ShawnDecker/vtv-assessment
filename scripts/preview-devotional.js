// Render today's devotional email to a local HTML file for preview.
// Run: node scripts/preview-devotional.js [day_number]
// Output: _preview/devotional-day-NN.html
const fs = require('fs');
const path = require('path');

const devs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'devotionals.json'), 'utf-8'));
const targetDay = parseInt(process.argv[2]) || (() => {
  const startDate = new Date('2026-04-06');
  const diffDays = Math.floor((Date.now() - startDate.getTime()) / 86400000);
  return ((diffDays % 60) + 60) % 60 + 1;
})();
const dev = devs.find(d => d.day_number === targetDay) || devs[0];

const escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const BASE_URL = 'https://assessment.valuetovictory.com';
const firstName = 'Shawn';
const today = new Date();

function loadChapterExcerpt(chapterNum) {
  try {
    const dir = path.join(__dirname, '..', 'data', 'rfm-chapters');
    const files = fs.readdirSync(dir);
    const padded = String(chapterNum).padStart(2, '0');
    const file = files.find(f => f.startsWith(padded + '-'));
    if (!file) return null;
    let raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    raw = raw.replace(/^---[\s\S]*?---\s*/, '').replace(/^#\s+.+\n+/, '');
    const paragraphs = raw.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 40 && !p.startsWith('#') && !p.match(/^\d+\s/));
    const totalWords = paragraphs.join(' ').split(/\s+/).length;
    let excerpt = ''; const used = [];
    for (const p of paragraphs) {
      if (excerpt.length + p.length > 800 && used.length >= 1) break;
      used.push(p); excerpt = used.join('\n\n');
      if (used.length >= 3) break;
    }
    return { excerpt, totalWords, paragraphCount: paragraphs.length };
  } catch (e) { return null; }
}
const chapterContent = loadChapterExcerpt(dev.chapter_number);

const themes = [dev.theme, dev.secondary_theme].filter(Boolean);
const themeBadges = themes.map(t => `<span style="display:inline-block;background:rgba(212,168,71,0.12);border:1px solid rgba(212,168,71,0.4);color:#D4A847;font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:12px;margin:2px 4px 2px 0;">${escapeHtml(t)}</span>`).join('');

const progressPct = Math.round((dev.day_number / 60) * 100);
const progressBar = `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 18px;">
    <tr><td>
      <div style="background:#27272a;border-radius:99px;height:6px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#D4A847,#f5d68a);width:${progressPct}%;height:6px;border-radius:99px;"></div>
      </div>
      <table width="100%"><tr>
        <td style="font-size:10px;color:#52525b;letter-spacing:1px;padding-top:6px;">DAY ${dev.day_number}</td>
        <td style="text-align:right;font-size:10px;color:#52525b;letter-spacing:1px;padding-top:6px;">${60 - dev.day_number} TO GO</td>
      </tr></table>
    </td></tr>
  </table>`;

let chapterExcerptHtml = '';
if (chapterContent && chapterContent.excerpt) {
  const excerptParas = chapterContent.excerpt.split('\n\n').filter(p => p.trim()).map(p => `<p style="color:#d4d4d8;font-size:15px;line-height:1.8;margin:0 0 14px;font-family:Georgia,serif;">${escapeHtml(p)}</p>`).join('');
  chapterExcerptHtml = `
    <div style="background:linear-gradient(180deg,#0f0f15 0%,#18181b 100%);border:1px solid #27272a;border-left:4px solid #D4A847;border-radius:10px;padding:28px 28px 24px;margin:0 0 24px;position:relative;">
      <div style="position:absolute;top:14px;right:18px;font-family:Georgia,serif;font-size:64px;color:rgba(212,168,71,0.15);line-height:1;">&rdquo;</div>
      <p style="color:#D4A847;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">From the Chapter</p>
      <p style="color:#71717a;font-size:11px;margin:0 0 16px;letter-spacing:0.5px;">Chapter ${dev.chapter_number} &middot; ${escapeHtml(dev.chapter_title)} &middot; ${chapterContent.totalWords.toLocaleString()} words total</p>
      ${excerptParas}
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid #27272a;text-align:center;">
        <a href="${BASE_URL}/audiobook?chapter=${dev.chapter_number}" style="display:inline-block;color:#D4A847;font-size:13px;font-weight:bold;text-decoration:none;padding:8px 16px;">&#9656; Listen to this chapter &nbsp;&middot;&nbsp; <span style="color:#a1a1aa;text-decoration:underline;">Continue reading &rarr;</span></a>
      </div>
    </div>`;
}

const subjectLine = `Day ${dev.day_number}/60: "${dev.title.replace(/^Day \d+:\s*/i,'')}" — ${dev.scripture_reference}`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${escapeHtml(subjectLine)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="background:#0f0f15;color:#888;padding:14px 24px;font-size:12px;font-family:monospace;border-bottom:1px solid #27272a;">
  <strong style="color:#D4A847;">PREVIEW MODE</strong> &middot; Subject: ${escapeHtml(subjectLine)} &middot; To: ${firstName} &middot; From: "Running From Miracles" &lt;valuetovictory@gmail.com&gt;
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 14px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1410 0%,#0a0a0a 60%);border:1px solid #27272a;border-radius:16px 16px 0 0;border-bottom:none;">
      <tr><td style="padding:32px 32px 22px;text-align:center;">
        <div style="display:inline-block;background:linear-gradient(135deg,#D4A847,#f5d68a);color:#0a0a0a;font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;padding:5px 14px;border-radius:12px;margin-bottom:14px;">&#10024; Daily Word &#10024;</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-style:italic;color:#ffffff;line-height:1.1;letter-spacing:-0.5px;margin:8px 0 4px;">Running From<br/><span style="color:#D4A847;">Miracles</span></div>
        <div style="font-size:11px;color:#71717a;letter-spacing:2px;text-transform:uppercase;margin-top:10px;">A 60-Day Devotional Journey</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-top:none;padding:0;">
      <tr><td style="padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;"><tr>
          <td><p style="color:#e4e4e7;font-size:17px;margin:0;font-weight:600;">${firstName},</p></td>
          <td style="text-align:right;"><p style="color:#52525b;font-size:11px;margin:0;letter-spacing:1px;text-transform:uppercase;">${today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p></td>
        </tr></table>
        ${progressBar}
        <div style="text-align:center;padding:16px 0 22px;border-bottom:1px solid #27272a;margin-bottom:24px;">
          <div style="font-size:11px;color:#52525b;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Chapter ${dev.chapter_number}</div>
          <div style="font-family:Georgia,serif;font-size:26px;color:#ffffff;line-height:1.2;margin-bottom:10px;">${escapeHtml(dev.title)}</div>
          <div style="margin-top:10px;">${themeBadges}</div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(212,168,71,0.08),rgba(212,168,71,0.02));border:1px solid rgba(212,168,71,0.3);border-radius:12px;padding:28px 26px;margin:0 0 26px;text-align:center;">
          <div style="font-family:Georgia,serif;font-size:80px;color:rgba(212,168,71,0.25);line-height:0.6;margin-bottom:-10px;">&ldquo;</div>
          <p style="color:#f5f5f5;font-family:Georgia,serif;font-size:19px;font-style:italic;line-height:1.6;margin:0 0 14px;">${escapeHtml(dev.scripture_text)}</p>
          <p style="color:#D4A847;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0;">&mdash; ${escapeHtml(dev.scripture_reference)} &mdash;</p>
        </div>
        ${chapterExcerptHtml}
        <div style="margin:0 0 24px;">
          <div style="display:inline-block;background:#27272a;color:#D4A847;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:14px;">Reflection</div>
          <p style="color:#d4d4d8;font-size:15px;line-height:1.75;margin:0;">${escapeHtml(dev.reflection)}</p>
        </div>
        <div style="background:#0f0f15;border:1px solid #27272a;border-radius:10px;padding:22px 24px;margin:0 0 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>
            <td style="vertical-align:middle;width:32px;"><div style="background:rgba(212,168,71,0.15);width:32px;height:32px;border-radius:50%;text-align:center;line-height:32px;font-size:16px;color:#D4A847;">&#10073;</div></td>
            <td style="vertical-align:middle;padding-left:10px;"><p style="color:#D4A847;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0;">Today's Prayer</p></td>
          </tr></table>
          <p style="color:#e4e4e7;font-size:14px;font-style:italic;line-height:1.7;margin:0;font-family:Georgia,serif;">${escapeHtml(dev.prayer)}</p>
        </div>
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02));border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:22px 24px;margin:0 0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
            <td style="vertical-align:middle;width:32px;"><div style="background:rgba(34,197,94,0.2);width:32px;height:32px;border-radius:8px;text-align:center;line-height:32px;font-size:16px;color:#22c55e;font-weight:bold;">&#10003;</div></td>
            <td style="vertical-align:middle;padding-left:10px;"><p style="color:#22c55e;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0;">Today's Action Step</p></td>
          </tr></table>
          <p style="color:#e4e4e7;font-size:15px;line-height:1.65;margin:0;font-weight:500;">${escapeHtml(dev.action_step)}</p>
        </div>
        <div style="background:linear-gradient(135deg,#1f1a14,#0f0d0a);border:1px solid rgba(212,168,71,0.4);border-radius:12px;padding:22px 24px;margin:0 0 8px;text-align:center;">
          <div style="display:inline-block;background:rgba(212,168,71,0.15);width:48px;height:48px;border-radius:50%;text-align:center;line-height:48px;font-size:22px;color:#D4A847;margin-bottom:10px;">&#9658;</div>
          <p style="color:#D4A847;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Listen to Today's Chapter</p>
          <p style="color:#a1a1aa;font-size:13px;margin:0 0 14px;">Hear Shawn read &ldquo;${escapeHtml(dev.chapter_title)}&rdquo; in his own voice</p>
          <a href="${BASE_URL}/audiobook?chapter=${dev.chapter_number}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:11px 28px;border-radius:8px;letter-spacing:0.5px;">&#9658;&nbsp;&nbsp;Play Chapter ${dev.chapter_number}</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #27272a;border-top:none;border-radius:0 0 16px 16px;padding:0;">
      <tr><td style="padding:18px 32px;text-align:center;">
        <a href="${BASE_URL}/daily-word" style="display:inline-block;color:#a1a1aa;font-size:12px;font-weight:bold;text-decoration:none;padding:6px 14px;letter-spacing:1px;text-transform:uppercase;">Read Online</a>
        <span style="color:#27272a;">&middot;</span>
        <a href="${BASE_URL}/audiobook" style="display:inline-block;color:#a1a1aa;font-size:12px;font-weight:bold;text-decoration:none;padding:6px 14px;letter-spacing:1px;text-transform:uppercase;">Audiobook</a>
        <span style="color:#27272a;">&middot;</span>
        <a href="${BASE_URL}/member" style="display:inline-block;color:#a1a1aa;font-size:12px;font-weight:bold;text-decoration:none;padding:6px 14px;letter-spacing:1px;text-transform:uppercase;">Dashboard</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="text-align:center;padding:24px 16px;">
    <p style="color:#52525b;font-size:11px;margin:0 0 6px;">Running From Miracles &mdash; 60-Day Devotional</p>
    <p style="color:#3f3f46;font-size:10px;margin:0 0 8px;">by Shawn E. Decker &middot; &copy; 2026 Value to Victory &middot; Goodview, VA</p>
    <p style="color:#3f3f46;font-size:10px;margin:0;">You're receiving this devotional because you opted in.<br/><a href="#" style="color:#6a6a84;text-decoration:underline;">Unsubscribe from Daily Word</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;

const outDir = path.join(__dirname, '..', '_preview');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `devotional-day-${String(dev.day_number).padStart(2,'0')}.html`);
fs.writeFileSync(outFile, html);
console.log('Preview written:', outFile);
console.log('Day:', dev.day_number, '/', 60);
console.log('Chapter:', dev.chapter_number, '-', dev.chapter_title);
console.log('Title:', dev.title);
console.log('Scripture:', dev.scripture_reference);
console.log('Themes:', themes.join(', '));
console.log('Chapter excerpt:', chapterContent ? `${chapterContent.totalWords} total words, ${chapterContent.excerpt.length} chars excerpted` : 'NOT FOUND');
console.log('Subject:', subjectLine);
