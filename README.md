# cori pre-launch site

A demand test, not a shop. Visitors swipe through the designs (in a random order per visitor), pick a favourite and leave an email and size. Nobody pays anything.

The look is the **Galleria** direction: a neutral frame, one red heart, and a page tint that changes to match the design on top.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
```

- `?preview=1` shows placeholder sketches even when `CATALOG.showSketches` is off.
- In development, events print to the console (`window.__coriEvents`) and sign-ups are kept in `localStorage["cori-dev-signups"]`.

## Where things live

| What | File |
|---|---|
| Name, price, sizes, consent wording, feature flags | `src/config.ts` |
| The designs (photos, sketches, colours) | `src/data/designs.ts` + `src/assets/designs/<slug>/` |
| Page and sections | `src/pages/index.astro` |
| Deck, form and done-screen logic | `src/scripts/app.ts` |
| Event log (cookieless, no emails ever) | `src/scripts/track.ts` |
| Sign-up sender with offline retry | `src/scripts/signup.ts` |
| Styles | `src/styles/global.css` |
| Privacy notice (draft, fill the [brackets]) | `src/pages/privacy.astro` |

## Adding a real design

1. Put 4 photos in `src/assets/designs/<slug>/`, in this order: `onbody` (running, front), `detail` (front held open), `back`, `lifestyle` (café). Match the biscotto's angles and light, at least 2,000 px on the long edge.
2. In `designs.ts`, import them, set `status: 'live'`, remove `sketch`, and set `swatch`/`tint`/`panel`.
3. Bump `CATALOG.version` in `config.ts`, so data from the old line-up stays separate.

## Before sharing the vote

- [ ] Name cleared.
- [ ] At least 3 real designs live; set `CATALOG.showSketches = false`.
- [ ] Backend connected: `PUBLIC_EVENTS_URL` and `PUBLIC_SIGNUP_URL` (Supabase Edge Functions), with MailerLite double opt-in.
- [ ] Privacy notice completed; real contact email in `config.ts`.
- [ ] Concept images retouched: no SiS or RÖAST branding.
- [ ] Domain bought and set in GitHub Pages; `BASE_PATH` removed.
- [ ] Tested inside the Instagram and WhatsApp in-app browsers, on iOS and Android.

## Link preview and icons

`npm run images` redraws `public/og.jpg` (the 1200×630 preview WhatsApp and iMessage show) and the icons from `scripts/make-images.mjs`. It is neutral on purpose: no single design is shown before someone votes.

## Deploying to GitHub Pages

Pushing to `main` deploys with `.github/workflows/deploy.yml`. It builds with `BASE_PATH=/cori` and `SITE_URL=https://teodorab16.github.io`; when a custom domain exists, drop `BASE_PATH`, set `SITE_URL` to the domain and add it in Settings → Pages. The site is marked `noindex` while it's a test.
