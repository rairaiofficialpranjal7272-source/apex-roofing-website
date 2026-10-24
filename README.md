# Apex Roofing Co.

A complete responsive roofing website built with React, TypeScript, Vite, and an Express backend. The final Apex Roofing brief is implemented rather than the earlier Sabrina Residences brief.

## Run

Requires Node.js 20.19+ (Node 22 LTS recommended).

```bash
npm ci
npm run dev
# http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The server binds to `0.0.0.0` and serves the site and API from the same origin. Browser requests use relative URLs. Run the Node server, not just a static-file host, for the booking workflow.

## Included

- AI-generated architectural hero with layered lighting, subtle pointer parallax, ambient particles, animated grid lines, and a glass information card.
- Choreographed word-by-word hero text and scroll-triggered section reveals, with a reduced-motion alternative.
- Three roofing service cards with working estimate preselection.
- Interactive roof components with keyboard-, touch-, and mouse-accessible hotspots.
- Three clearly labeled illustrative project examples, benefits, and a four-step process.
- Full appointment form with accessible inline validation, loading and error states, duplicate-click protection, conditional email requirements, consent, and image uploads.
- Genuine server-side validation and private local persistence; optional live webhook delivery.
- Configurable phone and WhatsApp links; no fabricated contact numbers.
- Honest ZIP availability checker, accessible FAQ accordions, privacy and terms dialogs, dynamic copyright year, and mobile navigation.
- Local optimized WebP images and subsetted WOFF2 Google fonts; no runtime font/CDN dependency.

## Configure the business

Edit **`src/config.ts`** with verified information:

- Company name (also controls the wordmark).
- Phone in E.164 format and a separate display number.
- Email, location, and business hours.
- WhatsApp number: country code and digits, no `+` or punctuation.
- Cities and ZIP codes: `serviceAreas: [{ city: 'Your verified city', zips: ['your actual ZIP'] }]`.
- Image paths.

No real addresses, credentials, reviews, statistics, guarantees, or service locations have been invented. Unconfigured call and WhatsApp controls explain that setup is pending instead of opening fake numbers. WhatsApp sends only the generic inquiry text; it never automatically includes form data. The service-area checker only reports availability for explicitly configured ZIPs.

Update the page title, description, Open Graph values, structured-data company name, and canonical URL in **`index.html`** when publishing under a verified domain. Do not add ratings, credentials, or address metadata unless verified.

## Appointment workflow — what is real now

Without integration credentials, the site operates in **clearly labeled local-preview mode**:

1. The browser validates the fields and sends multipart data to `POST /api/appointments`.
2. The server validates all fields, consent, date, service choices, phone format, ZIP, and conditional email requirements with Zod.
3. Optional uploads are limited to one JPG, PNG, or WebP, 5 MB maximum. The server checks signature bytes and MIME type, uses generated filenames, and does not serve uploaded files publicly.
4. Valid requests are saved as private JSON records in **`data/appointments/`**, with an optional adjacent image. Directory/file permissions are restricted where supported.
5. The result explicitly says **saved locally, not sent**, with a request reference. No email is claimed, and no appointment is confirmed.

There is deliberately no public inbox endpoint. A site administrator with server access can review records directly. Preview test submissions are removed by the test suite. The `data` directory is excluded from source archives and version control.

This local filesystem is suitable for the preview, **not a scalable production booking database**. Workspace snapshot retention is not a booking-data durability guarantee. Before public launch, use persistent protected hosting/storage or a verified delivery integration, restrict administrator access, define retention/deletion policies, and protect backups. Never commit real customer data.

## Connect live request delivery

Copy `.env.example` to `.env`, then configure:

```dotenv
APPOINTMENT_WEBHOOK_URL=https://your-trusted-https-receiver/roofing-requests
WEBHOOK_TOKEN=your-server-side-secret
```

The server automatically loads `.env`. Restart after changing environment settings.

The receiver must accept **multipart/form-data** with:

- `request`: a JSON string with `id`, `createdAt`, validated fields, consent, and the optional image filename.
- `photo`: the optional image binary.
- `Authorization: Bearer <WEBHOOK_TOKEN>` when configured.

Use the request `id` for deduplication. The receiver can be your own server, automation workflow, or a function that writes to Supabase and sends mail through your verified email provider. Store secrets only on the server. An HTTPS endpoint controlled by you is required; no credentials have been provisioned here.

The receiver must return a **2xx** response only after it has accepted the request for processing. A delivery failure or a 15-second timeout returns a visible error, never a false success. The frontend checks `/api/booking-status` and shows connected mode only when a webhook URL is present. A 2xx response means the request was accepted by that integration, not that an appointment has been confirmed or an email has necessarily been sent. Test the receiver, its data retention, and the actual notification path before launch.

## Security and production checklist

- HTTPS, a real company contact, verified service areas, and reviewed business policies.
- Deploy `npm run build` plus `npm start` with a persistent private writable `data/appointments` volume, or replace local storage with your protected database/object storage.
- Basic per-IP process-local rate limiting, an origin check, and a honeypot are included. For public traffic, add shared rate limiting, abuse protection/CAPTCHA, monitoring, and alerting. Configure proxy trust carefully for your infrastructure; do not blindly trust all forwarded IP headers.
- Uploads are checked for size, MIME, and signature. For a public high-volume deployment, decode/re-encode uploads, strip metadata, and add malware scanning/storage lifecycle rules. Keep uploads private.
- The preview privacy/terms content explains actual behavior but is **not a substitute for legal review**. Publish the operator's contact, processors, retention period, and rights/deletion workflow.
- Confirm delivery end-to-end. There are no automatic scheduling, emergency response, insurance, warranty, or hidden-damage diagnosis claims.

## Testing

With the website running:

```bash
npx playwright install --with-deps chromium
npm test
```

The test suite checks:

- Widths **375, 390, 430, 768, 1024, 1440, and 1920px**, horizontal overflow and broken images.
- Mobile navigation, keyboard roof controls, ZIP checker, FAQ, and dialog dismissal.
- Inline validation, conditional email, file selection, recoverable delivery failure, real local submission storage, and truthful result text.
- Server rejection of invalid fields, past dates, spoofed image bytes, and cross-origin submissions.
- Browser runtime errors and automated axe WCAG A/AA checks on desktop and mobile.

Reports and visual screenshots are written to `test-results/`. Automated accessibility checks do not replace a full manual assistive-technology audit. Tests are designed for local-preview mode and clean up their own records.

## Source layout

```
src/config.ts              Editable company information and service content
src/ui.tsx                 Shared word animation, logo, and section labels
src/AppointmentForm.tsx    Validated booking UI and request states
src/main.tsx               Page sections and interactions
src/styles.css             Responsive design system and animations
src/fonts.css              Self-hosted font faces
server.mjs                 Express API, validation, storage, optional webhook
public/images/*.webp       Optimized generated imagery
public/fonts/*.woff2       Self-hosted fonts
licenses/                  Font license notices
artwork-source/            Original generated PNGs (not needed at runtime)
tests/                     Browser interaction, API, and accessibility checks
```

All architectural photographs are AI-generated illustrative assets, not actual completed Apex projects. Google Fonts Space Grotesk and Inter are supplied under their included SIL Open Font Licenses.
