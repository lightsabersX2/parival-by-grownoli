---
name: local-page
description: The local page that shows runs of ads, with every loop side by side, ratings and comments. Use to open or show a run, to look at the ads in a browser, or to read what the person rated and commented there.
---

# Local page

The page shows every run in a runs folder: each brand, each run, each ad in its five formats, and every loop of an ad side by side. The person rates versions and writes comments there, and you read them. Paths below are relative to this skill's folder. `<runs>` is the folder that holds the runs, by default `~/Documents/Ads/runs`.

The page runs on this computer only, at an address that starts with `127.0.0.1`. It sends nothing anywhere and needs Node 22 or later and nothing else.

## Open it

Run `node scripts/page.mjs start <runs>`. It starts the page if it is not running, opens it in the person's browser and prints its `address`. Give the person that address. The page closes by itself after an hour without a visit, and an open tab counts as a visit, and `node scripts/page.mjs stop <runs>` closes it at once. Done when the command printed an address.

New ads appear on the page as they are made, so open it at the start of a long run when the person wants to follow along.

Tell the person what they can do there, in one or two lines: click an ad to rate it and write a note, click a spot on the picture to comment on that spot, and choose Compare Versions to see every loop of an ad side by side.

## Read what the person left

Run `node scripts/page.mjs comments <runs>`. It prints, per run and format, each version's rating, note and comments pinned to a spot, with the `html` file each is about. The ratings mean:

- **star**: locked. Keep this version as it is.
- **up**: good direction. Build on this version.
- **down**: wrong direction, or disliked. Move away from it.

A comment's `from_left` and `from_top` say where on the picture it points, so open the `image` and look at that spot before changing anything. Then revise by the `campaign-run` skill's section on what to do after the person has looked. Done when you have told the person, comment by comment, what you read and what you will change.
