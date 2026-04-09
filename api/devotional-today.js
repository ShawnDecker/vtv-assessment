/**
 * GET /api/devotional-today
 * Returns today's devotional based on a 60-day cycle
 * Cycles through all 60 devotionals continuously
 */

const fs = require('fs');
const path = require('path');

// Load devotionals at startup
let devotionals = [];
try {
  const devotionalsPath = path.join(__dirname, '..', 'data', 'devotionals.json');
  devotionals = JSON.parse(fs.readFileSync(devotionalsPath, 'utf-8'));
} catch (e) {
  // Fallback: embedded first devotional
  devotionals = [{
    day_number: 1,
    chapter_title: "Introduction",
    title: "Day 1: Introduction",
    theme: "faith",
    scripture_reference: "Hebrews 11:1",
    scripture_text: "Now faith is the substance of things hoped for, the evidence of things not seen.",
    reflection: "In this chapter, Shawn shares about trusting God when everything around you says there's no reason to believe. Sometimes life throws us into situations we never asked for. But God is in the details — even the ones that hurt.",
    prayer: "Lord, thank You for Shawn's testimony about faith. Help me to see Your hand in my own journey. Give me eyes to see the miracles I've been running from. In Jesus' name, Amen.",
    action_step: "Take 5 minutes today to write down one moment where God showed up when you least expected it."
  }];
}

module.exports = (req, res) => {
  // CORS — locked to allowed origins
  const ALLOWED = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','http://localhost:3000','http://localhost:5173'];
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED.includes(origin) ? origin : (origin.endsWith('.vercel.app') ? origin : ALLOWED[0]);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Vary', 'Origin');

  // Calculate which day we're on (60-day cycle from a start date)
  const startDate = new Date('2026-04-06'); // Start date for cycle
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const dayIndex = ((diffDays % 60) + 60) % 60; // Always positive, 0-59

  const devotional = devotionals[dayIndex] || devotionals[0];

  res.status(200).json({
    success: true,
    cycle_day: dayIndex + 1,
    total_days: 60,
    date: today.toISOString().split('T')[0],
    devotional: devotional
  });
};
