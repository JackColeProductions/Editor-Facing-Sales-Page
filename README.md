# Video Production+ — Landing Page

A static HTML/CSS/JS clone of the [vpplus.cc](https://vpplus.cc/) landing page,
focused on the core branding, design system, and page layout. Content
placeholders (wins gallery, testimonials, hero proof avatars) are scaffolded
so real images, videos, and copy can be dropped in later.

## Stack

- Plain `index.html` + `styles.css` + `script.js` — no build step.
- Lufga via `fonts.cdnfonts.com` (matches the original site).
- Design tokens defined as CSS custom properties at `:root`.

## Run locally

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or via npm (matches what Railway runs):

```bash
npm install
npm start
# default http://localhost:3000
```

## Deploy to Railway

Two options.

**Option A — Dashboard (easiest):**
1. Push this branch (already done).
2. On [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Pick `JackColeProductions/Editor-Facing-Sales-Page` and the
   `claude/clone-vpplus-landing-nJ27X` branch.
4. Railway auto-detects Node via `package.json` and runs `npm start`. The
   `serve` package binds to `$PORT` so no extra config is needed.
5. After the first deploy, click **Settings → Networking → Generate Domain**
   to get a public URL (e.g. `vpplus-landing-production.up.railway.app`).

**Option B — Railway CLI:**

```bash
npm i -g @railway/cli
railway login
railway init        # create a new project
railway up          # deploy current directory
railway domain      # generate a public URL
```

`railway.json` pins the builder to Nixpacks and the start command to `npm start`.

## Design system

| Token        | Value                          | Use                       |
| ------------ | ------------------------------ | ------------------------- |
| `--bg`       | `hsl(240 20% 4%)`              | Page background           |
| `--card`     | `hsl(240 15% 8%)`              | Card surfaces             |
| `--border`   | `hsl(240 10% 15%)`             | Hairlines / dividers      |
| `--primary`  | `hsl(180 74% 63%)` (cyan)      | Buttons, accents, links   |
| `--mint`     | `hsl(160 76% 56%)`             | Secondary accent          |
| `--coral`    | `hsl(0 72% 71%)`               | Pain points / destructive |
| `--fg`       | `#ffffff`                      | Primary text              |
| `--fg-muted` | `hsl(240 5% 70%)`              | Body / secondary text     |

Display font: **Lufga**, 700–800 for headings, uppercase + tight tracking.

## Sections

1. Sticky nav with brand mark + Apply CTA
2. Hero: "GET ACCESS TO / DREAM CLIENTS — FOR EDITORS. BY EDITORS."
3. Stats strip
4. The VP+ Way — old-way vs new-way comparison
5. 4 feature cards
6. Marketplace board preview (sample jobs)
7. Wins gallery (placeholder grid — drop screenshots in)
8. Testimonials (3 cards)
9. What's included (4 cards)
10. FAQ accordion
11. Final CTA card
12. Footer

## What to drop in later

- Real wins screenshots → `.win__ph` placeholders in the Wins section
- Hero proof avatars → `.avatar` swatches
- Testimonial avatars + names → `.quote__avatar` + `figcaption`
- Apply / signup link → all `href="#apply"` and the final CTA `href="#"`
- A hero video/poster if desired (slot above `.hero__title`)
