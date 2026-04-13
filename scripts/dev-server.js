#!/usr/bin/env node
/**
 * VTV Local Dev Server
 * Runs the full VTV Assessment Platform locally, connected to the production Neon database.
 * Wraps Vercel serverless functions in a local Express server.
 *
 * Usage:
 *   npm run dev
 *
 * Requirements:
 *   - .env file with DATABASE_URL, GMAIL_USER, GMAIL_APP_PASSWORD, etc.
 *   - For local AI: Ollama running on port 11434 (set AI_PROVIDER=local in .env)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Set BASE_URL for local dev if not already set
if (!process.env.BASE_URL) {
  process.env.BASE_URL = `http://localhost:${PORT}`;
}

// ========== API ROUTES (mirrors vercel.json routing) ==========

// Lazy-load handlers on first request so the server starts even if
// some env vars (STRIPE_SECRET_KEY, etc.) aren't set yet.
const handlerCache = {};
function lazyHandler(modulePath) {
  return (req, res) => {
    try {
      if (!handlerCache[modulePath]) {
        handlerCache[modulePath] = require(modulePath);
      }
      handlerCache[modulePath](req, res);
    } catch (err) {
      console.error(`[error] Failed to load ${modulePath}:`, err.message);
      res.status(500).json({ error: `Module load failed: ${err.message}` });
    }
  };
}

// Checkout routes (webhook + regular)
app.all('/api/checkout/webhook', lazyHandler('../api/checkout'));
app.all('/api/checkout', lazyHandler('../api/checkout'));

// Specific API routes (order matters — most specific first)
app.all('/api/cart-checkout',             lazyHandler('../api/cart-checkout'));
app.all('/api/free-book-signup',          lazyHandler('../api/free-book-signup'));
app.all('/api/verify-email',              lazyHandler('../api/verify-email'));
app.all('/api/health',                    lazyHandler('../api/health'));
app.all('/api/entitlements',              lazyHandler('../api/entitlements'));
app.all('/api/migrate-digital-purchases', lazyHandler('../api/migrate-digital-purchases'));
app.all('/api/send-email',                lazyHandler('../api/send-email'));
app.all('/api/migrate-analytics',         lazyHandler('../api/migrate-analytics'));
app.all('/api/devotional-today',          lazyHandler('../api/devotional-today'));
app.all('/api/ai',                        lazyHandler('../api/ai'));

// Relationship routes — /api/couples/* and /api/r/*
app.all('/api/couples/{*path}', lazyHandler('../api/relationships'));
app.all('/api/r/{*path}',       lazyHandler('../api/relationships'));

// Dating routes
app.all('/api/dating/{*path}',  lazyHandler('../api/dating'));

// Catch-all API route — main handler (must be last API route)
app.all('/api/{*path}', lazyHandler('../api/index'));

// ========== STATIC FILES ==========

// Serve static assets from project root
app.use(express.static(path.join(__dirname, '..'), {
  extensions: ['html'],
  index: false,
}));

// ========== CLEAN URL ROUTES (mirrors vercel.json) ==========

const htmlRoutes = {
  '/member':            'member.html',
  '/pricing':           'pricing.html',
  '/premium':           'premium.html',
  '/checkout/success':  'checkout-success.html',
  '/privacy':           'privacy.html',
  '/terms':             'terms.html',
  '/dating':            'dating.html',
  '/about-pink':        'about-pink.html',
  '/progress':          'progress.html',
  '/settings':          'settings.html',
  '/refer':             'refer.html',
  '/help':              'faq.html',
  '/faq':               'faq.html',
  '/testimonials':      'testimonials.html',
  '/coaching-history':  'coaching-history.html',
  '/certificate':       'certificate.html',
  '/free-book':         'free-book.html',
  '/action-plan':       'action-plan.html',
  '/counselor-report':  'counselor-report.html',
  '/team-report':       'team-report.html',
  '/partner-invite':    'partner-invite.html',
  '/couple-report':     'couple-report.html',
  '/challenge':         'challenge.html',
  '/returning':         'returning.html',
  '/onboarding':        'onboarding.html',
  '/relationship-hub':  'relationship-hub.html',
  '/intimacy':          'intimacy.html',
  '/relationship-matrix': 'relationship-matrix.html',
  '/love-language':     'love-language.html',
  '/couple-challenge-hub': 'couple-challenge.html',
  '/cherish-honor':     'cherish-honor.html',
  '/coaching':          'coaching.html',
  '/stuck':             'stuck.html',
  '/compare':           'compare.html',
  '/teams':             'teams.html',
  '/realestate':        'realestate.html',
  '/audiobook':         'audiobook.html',
  '/daily-word':        'daily-word.html',
  '/admin/contacts':    'admin-contacts.html',
  '/agent-dashboard':   'agent-dashboard.html',
};

// Framework pillar routes
const pillars = ['time', 'people', 'influence', 'numbers', 'knowledge'];
for (const p of pillars) {
  htmlRoutes[`/framework/${p}`] = `framework-${p}.html`;
}

// Register all HTML routes
for (const [urlPath, file] of Object.entries(htmlRoutes)) {
  app.get(urlPath, (req, res) => {
    res.sendFile(path.join(__dirname, '..', file));
  });
}

// Wildcard routes for pages with dynamic segments
app.get('/report/{*id}', (req, res) => res.sendFile(path.join(__dirname, '..', 'report.html')));
app.get('/action-plan/{*id}', (req, res) => res.sendFile(path.join(__dirname, '..', 'action-plan.html')));
app.get('/counselor-report/{*id}', (req, res) => res.sendFile(path.join(__dirname, '..', 'counselor-report.html')));
app.get('/team-report/{*id}', (req, res) => res.sendFile(path.join(__dirname, '..', 'team-report.html')));
app.get('/premium/{*sub}', (req, res) => res.sendFile(path.join(__dirname, '..', 'premium.html')));

// Catch-all — serve index.html (main assessment page)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ========== START ==========

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║     VTV Assessment Platform — Local Dev      ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Server:    http://localhost:${PORT}             ║`);
  console.log(`  ║  AI Mode:   ${(process.env.AI_PROVIDER || 'cloud').padEnd(33)}║`);
  const dbStatus = process.env.DATABASE_URL ? 'Connected (Neon)' : 'NOT CONFIGURED';
  console.log(`  ║  Database:  ${dbStatus.padEnd(33)}║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  if (!process.env.DATABASE_URL) {
    console.log('  [warn] DATABASE_URL not set — copy .env.example to .env');
  }
  if (process.env.AI_PROVIDER === 'local') {
    console.log('  [info] Local AI mode — make sure Ollama is running:');
    console.log('         ollama serve');
    console.log('         ollama pull llama3.1:8b');
  }
  console.log('');
});
