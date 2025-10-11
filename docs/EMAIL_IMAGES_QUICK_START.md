# Email Images System - Quick Start

## 🚀 Installation Complete!

The email images system has been successfully integrated into Aidin Helpdesk. This guide will help you test it.

## ✅ What's Been Done

1. **Database Schema** - Added `InboundMessage` and `MessageAsset` models
2. **Backend Services** - 6 modules for parsing, storage, sanitization, and CID resolution
3. **API Routes** - 3 endpoints for ingestion, asset serving, and gallery
4. **Frontend Components** - EmailMessageViewer with inline images and gallery
5. **Tests** - Unit tests for hash and HTML sanitizer
6. **NPM Packages** - Installed sharp, mailparser, DOMPurify, AWS SDK, jsdom

## 📋 Next Steps

### 1. Configure Environment

Add to `.env.local`:

```env
# Minimal config for local development
ASSETS_DRIVER=disk
ASSETS_DIR=./storage/assets
APP_BASE_URL=http://localhost:3000
ASSET_SIGNING_SECRET=$(openssl rand -hex 32)
```

Or copy the example file:
```bash
cat .env.email-images.example >> .env.local
```

### 2. Test the System

#### Option A: Use the Test Fixture

Send a test email with inline images:

```bash
curl -X POST http://localhost:3000/api/inbound/email-images \
  -H "x-webhook-secret: your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/email-with-images.json
```

#### Option B: Test with Real Email

1. Send an email to `helpdesk@surterreproperties.com` with:
   - An inline image (paste a screenshot or embed a logo)
   - An attached image

2. The email polling service will fetch it every 60 seconds

3. View the ticket to see:
   - Inline images rendered in place
   - Attached images in the gallery below

### 3. Verify It Works

**Check the ticket page:**
1. Navigate to a ticket that was created from email
2. Inline images should appear in the email body
3. Attached images should appear in a gallery grid
4. Click any image to open full-size lightbox

**Check the database:**
```bash
npx prisma studio
```

Look for:
- `inbound_messages` table with `htmlSanitized` containing `<img>` tags with `/api/assets/` URLs
- `message_assets` table with 3 variants per image (original, web, thumb)

**Check storage:**
```bash
ls -lR storage/assets/
```

You should see:
```
storage/assets/tickets/{ticketId}/{sha256}/
  ├── original.png
  ├── web.webp
  └── thumb.webp
```

## 🔧 Troubleshooting

### "Module not found" errors

```bash
npm install
npx prisma generate
```

### Images not displaying

1. Check browser console for 401 errors
2. Verify `APP_BASE_URL` in `.env.local`
3. Check that signed URLs have `?token=...`

### Sharp build errors

```bash
npm rebuild sharp
```

## 📝 Example Test Email

Here's a minimal test you can send:

**Subject:** Test Inline Images

**Body (HTML):**
```html
<h1>Hello!</h1>
<p>Testing inline image:</p>
<p><img src="cid:logo@test" alt="Logo"></p>
```

**Attachments:**
- `logo.png` with `contentId: logo@test` and `disposition: inline`

## 📚 Full Documentation

See `docs/EMAIL_IMAGES_SETUP.md` for:
- Complete architecture diagrams
- Security considerations
- S3/Spaces configuration
- API reference
- Performance tuning
- Production deployment guide

## 🎯 Features Enabled

- ✅ CID resolution (`cid:image@id` → signed URLs)
- ✅ Data URI conversion (`data:image/png;base64,...` → stored assets)
- ✅ Auto image optimization (WEBP, 1600px max width)
- ✅ Thumbnail generation (320px)
- ✅ EXIF auto-rotation
- ✅ SHA-256 deduplication
- ✅ Signed URL authentication (15 min expiry)
- ✅ HTML sanitization (XSS protection)
- ✅ Attachment gallery
- ✅ Lightbox modal
- ✅ Disk and S3 storage

## 🛠️ Development

**Run tests:**
```bash
npm test tests/unit/email-images
```

**Watch mode:**
```bash
npm test -- --watch
```

**Build production:**
```bash
npm run build
```

## 🚢 Production Deployment

1. Set `ASSETS_DRIVER=s3` in production
2. Configure S3 bucket and credentials
3. Ensure `APP_BASE_URL` points to production domain
4. Generate secure `ASSET_SIGNING_SECRET`
5. Run `npx prisma migrate deploy`
6. Restart application

## ✨ You're All Set!

The system is ready to use. Send a test email and watch inline images render beautifully in your tickets!

For questions or issues, refer to the full documentation or create a GitHub issue.
