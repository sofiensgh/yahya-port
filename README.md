# yahya-port

Portfolio of **Yahia Delly**, Customer Support Agent based in Lisbon.

A hand-drawn, interactive portfolio:

1. **Loading intro**: the name is drawn in ink, with a progress counter.
2. **Landing**: a sketched "Customer Support" shop. The door opens the work, the window opens About, the mailbox opens Contact.
3. **Walk-through**: a 3D hallway of doors (scroll, swipe or arrow keys). Opening a door shows that section as a room.

A **Classic view** toggle switches to a normal scrolling page with the same content.

## Run locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy

`npm run build` copies the site into `dist/` (no dependencies needed).

- **From GitHub:** import this repo into [Vercel](https://vercel.com/new). `vercel.json` already sets the build command (`npm run build`) and output directory (`dist`).
- **From the CLI:** `npm run build`, then `npx vercel dist --prod`.

## Files

- `index.html`: markup and all content (CV text lives here)
- `style.css`: styles and animations
- `script.js`: intro loader, view toggle, hallway engine, rooms, sound, cursor

## To do

- Add the LinkedIn URL (search for `TODO` in `index.html`)
- Add `Yahia-Delly-CV.pdf` to the root for the CV download link
- Optionally replace the sketch portrait with a real photo
