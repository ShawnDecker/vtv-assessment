// Shared Zod schemas for validating query/body inputs across the API.
// Use: const { memberQuery } = require('./_validators'); const q = memberQuery.parse(params);
// On invalid input Zod throws — handlers should catch and return 400.

const { z } = require('zod');

const email = z.string().email().max(254).transform(s => s.toLowerCase().trim());

const memberQuery = z.object({
  email: email.optional(),
});

const pinVerify = z.object({
  email,
  pin: z.string().min(4).max(32).regex(/^[a-zA-Z0-9]+$/),
});

const checkoutSession = z.object({
  email,
  tier: z.enum(['individual', 'couple', 'premium']),
  priceId: z.string().startsWith('price_').optional(),
});

function safeParse(schema, input) {
  const r = schema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.flatten() };
}

module.exports = { email, memberQuery, pinVerify, checkoutSession, safeParse };
