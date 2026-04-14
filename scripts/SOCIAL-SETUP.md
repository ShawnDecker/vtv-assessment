# VTV Social Media Publishing Setup

## Step 1: Meta (Instagram + Facebook) Setup

### Get Your Instagram Business Account ID & Access Token

1. Go to https://developers.facebook.com
2. Click "My Apps" → "Create App" → Business type
3. Add the **Instagram Graph API** product
4. Go to https://developers.facebook.com/tools/explorer/
5. Select your app
6. Click "Generate Access Token"
7. Select permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
8. Click "Generate"
9. Copy the token — this is your **META_ACCESS_TOKEN**

### Get Your Instagram Business Account ID

In the Graph API Explorer:
```
GET /me/accounts
```
This returns your Facebook Pages. Find your page, copy the `id`.

Then:
```
GET /{page-id}?fields=instagram_business_account
```
Copy the `instagram_business_account.id` — this is your **INSTAGRAM_BUSINESS_ACCOUNT_ID**

### Get a Long-Lived Token (lasts 60 days)

```
GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}
```

## Step 2: Twitter/X Setup

1. Go to https://developer.twitter.com
2. Create a project and app
3. Enable OAuth 2.0
4. Set callback URL: `https://n8n.srv1138119.hstgr.cloud/rest/oauth2-credential/callback`
5. Copy your **Client ID** and **Client Secret**

## Step 3: Set n8n Environment Variables

On your n8n instance, set these environment variables:

```
META_ACCESS_TOKEN=your-long-lived-token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-ig-business-id
FACEBOOK_PAGE_ID=your-facebook-page-id
```

## Step 4: Import the Workflow

1. Open n8n (http://localhost:5678 or your Hostinger URL)
2. Click "Workflows" → "Import from File"
3. Select `scripts/n8n-social-publish-workflow.json`
4. For the Twitter node: click it → Credentials → Add new OAuth2 credential
5. **Activate** the workflow

## Step 5: Test It

From your terminal:
```bash
curl -X POST https://assessment.valuetovictory.com/api/social/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "platform": "instagram",
    "content": "\"Of all the things I have learned in my life, the most important is that God disguises miracles.\" — Running From Miracles, Ch. 1\n\nWhat miracle are you running from today?\n\n#RunningFromMiracles #ValueToVictory #Faith #AlignedHearts"
  }'
```

## Step 6: Auto-Publish Devotionals Daily

Add this cron to Vercel (or call manually):
```bash
curl -X POST https://assessment.valuetovictory.com/api/social/publish-devotional \
  -H "x-api-key: YOUR_ADMIN_KEY"
```

This auto-publishes today's devotional (from Running From Miracles) to all platforms.

## Quick Reference: API Endpoints

| Endpoint | Method | What It Does |
|----------|--------|-------------|
| `/api/social/publish` | POST | Publish to one platform |
| `/api/social/publish-devotional` | POST | Auto-publish today's devotional to all |
| `/api/n8n/trigger` | POST | Trigger any n8n workflow |
| `/api/n8n/status` | GET | Check n8n connectivity |
