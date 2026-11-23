---
name: studio-export
description: Turns a finished HTML ad into a project file for Grownoli Studio, where its words, photo and logo can be edited by hand. Use when the person wants to open, edit or finish an ad in Grownoli Studio.
---

# Studio export

One HTML ad becomes one project file that Grownoli Studio imports. A run exports one format at a time: point the script at the kept `ad.html` of each format. Paths below are relative to this skill's folder.

Run `node scripts/studio-export.mjs <ad.html> <out.zip>`. Put the ZIP beside the ad and name it after the ad. The script reads the ad's size from `final.png` or `ad.png` beside the HTML; pass `--size 1080x1080` when neither exists. It needs Node 22 or later and Chrome, Chromium, Edge or Brave.

Grownoli Studio has five canvases: 1:1, 3:4, 9:16, 16:9 and 4:3. The script refuses any other shape and says so. Tell the person, and offer to make the ad again in the nearest of the five.

What the person gets in the Studio:

- **Words** as text layers they can retype, move and resize, in the ad's own fonts when the ad ships its font files.
- **Photo and logo** as one picture layer each, when the HTML marks them with `data-role`.
- **A ground of one plain colour** as the Studio's own background colour, which the Background panel changes. The script prints it as `background`.
- **Everything else**, such as gradients, shapes and shadows, as flat picture layers that can be moved or removed, with their look fixed. A ground that is not one colour is one of these and arrives locked, so that it does not catch clicks meant for the photo; the Layers panel unlocks it.

Report every line the script prints under `notes`: each one names something the Studio will show differently from the ad, such as a font the ad has no file for.

Then tell the person how to open it: sign in to Grownoli Studio at grownoli.com, click Templates in the top bar, choose the Mine tab, click Import and pick the ZIP. Dropping the ZIP on the canvas does nothing, so name the buttons. Give the ZIP's full path. Done when the script printed `file` and the person has that path and those steps.
