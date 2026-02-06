# Berlin Frame Atlas (Static)

A zero-config, static photography guide for Berlin. No backend, no build step, and no external API dependencies. Deployable on Vercel (or any static host) by simply pointing to the repo root.

## Files

- `index.html` — main markup
- `styles.css` — styling
- `app.js` — UI logic and Leaflet map
- `data.js` — curated locations

## Deploy (Vercel)

1. Import the repo.
2. Leave **Root Directory** empty (use repo root).
3. Ensure **Build Command** and **Output Directory** are not set.
4. Deploy.

## Local preview

Open `index.html` in a browser.

## Update content

Edit `data.js` to add/remove locations or change copy.

## Notes

- Leaflet is loaded from a CDN and requires no build.
- All data is static for reliability.
