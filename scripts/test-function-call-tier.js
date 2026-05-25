/**
 * Local smoke test for the new tool-call escalation tier in api/ai.js.
 *
 * Invokes the handler directly (no HTTP layer) with a mock req/res so we can
 * exercise the full Ollama → Haiku → Opus chain with real local Ollama and
 * real .env.local credentials.
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   node ../../_claude/scripts/test-function-call-tier.js
 * From vtv-assessment/ dir.
 */
const handler = require('../api/ai.js');

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a recipient',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stripe_charge',
      description: 'Retrieve a Stripe charge by ID for refund/lookup',
      parameters: {
        type: 'object',
        properties: { charge_id: { type: 'string' } },
        required: ['charge_id'],
      },
    },
  },
];

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
  return res;
}

function mockReq(body) {
  return {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ADMIN_API_KEY || '',
      'content-type': 'application/json',
    },
    body,
  };
}

async function runTest(label, userMessage, expectedTool) {
  console.log(`\n=== ${label} ===`);
  console.log(`User: ${userMessage}`);
  const req = mockReq({ action: 'function-call', tools, userMessage });
  const res = mockRes();
  const start = Date.now();
  await handler(req, res);
  const elapsed = Date.now() - start;
  console.log(`HTTP: ${res.statusCode}  Time: ${elapsed}ms`);
  console.log(`Response: ${JSON.stringify(res.body, null, 2)}`);

  if (res.statusCode !== 200) {
    console.log(`❌ FAIL — non-200 status`);
    return false;
  }
  const got = res.body.tool;
  if (expectedTool === null && got === null) {
    console.log(`✅ PASS — correctly refused (tool=null)`);
    return true;
  }
  if (got === expectedTool) {
    console.log(`✅ PASS — chose ${got}`);
    return true;
  }
  console.log(`❌ FAIL — got tool=${got}, expected ${expectedTool}`);
  return false;
}

async function main() {
  // Validate env
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.ADMIN_API_KEY) missing.push('ADMIN_API_KEY');
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY (cloud fallback would fail)');
  if (!process.env.OLLAMA_HOST) process.env.OLLAMA_HOST = 'http://localhost:11434';
  if (missing.length) {
    console.log('ENV MISSING:', missing.join(', '));
    if (missing.some(m => m.startsWith('DATABASE_URL') || m.startsWith('ADMIN_API_KEY'))) {
      console.log('Cannot run without DATABASE_URL or ADMIN_API_KEY. Aborting.');
      process.exit(1);
    }
  }

  console.log('ENV check passed.');
  console.log('OLLAMA_HOST:', process.env.OLLAMA_HOST);
  console.log('ADMIN_API_KEY:', process.env.ADMIN_API_KEY ? `set (${process.env.ADMIN_API_KEY.length} chars)` : 'MISSING');
  console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.length} chars)` : 'MISSING');

  const results = [];
  results.push(await runTest('Test 1: simple weather call', 'What is the weather in Roanoke VA?', 'get_weather'));
  results.push(await runTest('Test 2: multi-tool Stripe pick', 'Find the Stripe charge ch_3PvLm1ChDdL2pNXyZQ for refund.', 'get_stripe_charge'));
  results.push(await runTest('Test 3: refusal (no tool fits)', 'Tell me a joke.', null));

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => {
  console.error('Test crashed:', e);
  process.exit(2);
});
