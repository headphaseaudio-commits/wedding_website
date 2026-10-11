# Stephanie & Jakub — wedding RSVP site

Bilingual (EN/PL) static site. No build step, no framework: `index.html`, `styles.css`, `script.js`, `i18n.js`, `config.js`.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000  (or ?lang=pl)
```

## Edit

- **Settings** (RSVP endpoint, deadline, contact email): `config.js`
- **All translatable copy**: `i18n.js` (keys match `data-i18n*` attributes in `index.html`)
- **Explore Głogów** (including the "Say it like a local" phrases) is English-only and live directly in `index.html` (`data-lang-only="en"`).

Language is picked from `?lang=pl|en`, then the visitor's last choice, then browser language. Use `…/?lang=pl` in the QR code on the Polish invite and `…/?lang=en` on the English one.

## Collecting replies (Google Sheets, free)

1. Create a Google Sheet → **Extensions → Apps Script**.
2. Paste `apps-script/Code.gs`, set `NOTIFY_EMAIL` if you want an email per reply. Save.
3. **Deploy → New deployment → Web app**. Execute as: *Me*. Who has access: *Anyone*. Authorise.
4. Copy the web-app URL (`https://script.google.com/macros/s/…/exec`) into `rsvpEndpoint` in `config.js`.

Replies land in the `RSVPs` tab. Diet chips are stored as canonical English values (`vegetarian`, `gluten-free`, …) regardless of the guest's language, so the caterer's list is consistent.

Until `rsvpEndpoint` is set the form runs in preview mode: it validates and shows the thank-you screen but saves nothing (a small note says so).

## Deploy

Any static host works. GitHub Pages: Settings → Pages → deploy from branch → `/ (root)`. Custom domain optional.
