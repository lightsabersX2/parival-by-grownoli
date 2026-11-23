# Parival by Grownoli

Parival is a plugin for Claude Code. It makes whole campaigns of finished ads from a brand's own pictures and shows them on a page on your own computer, where you rate them and comment.

## What it does

- **Makes a run.** Ask "Make a campaign for example.com". Claude reads the site, plans two or more ads, and makes each one in five formats: 1:1, 3:4, 9:16, 16:9 and 4:3. Every format is composed for its own shape. Each ad is one HTML file rendered to a PNG.
- **Reviews its own work.** Each format goes through up to three loops. A critic that has not seen Claude's reasoning names what is wrong, Claude revises, and a judge that does not know which version is newer picks the better one. A revision that loses is set aside. The critics and judges run on your own Claude plan.
- **Shows the run on a local page.** Ask "Show me the run". The page opens in your browser with every ad, every format and every loop side by side. Rate a version, write a note, or click a spot on the picture to comment on it. Then ask Claude to read your comments and revise.
- **Makes a single ad.** Ask "Make an ad for example.com" when one picture is enough.
- **Exports for Grownoli Studio.** Ask "Export this ad for Grownoli Studio". The ad becomes a project file whose words, photo, logo and background colour can be changed by hand in the Studio.

## What it needs

- Claude Code, in the Claude app or in a terminal.
- Node 22 or later. Nothing is installed with npm.
- Chrome, Chromium, Edge or Brave, for rendering the ads. Set `CHROME_BIN` when the browser sits in an unusual place.
- `git`, to add the plugin from GitHub.

Stock photos are off unless you set your own free Unsplash key as `UNSPLASH_ACCESS_KEY`. Ads work without it.

## Add it in the Claude app

1. Open Customize and choose Plugins.
2. Click Add, then Add marketplace.
3. Enter `lightsabersX2/parival-by-grownoli`.
4. Install Parival by Grownoli from the list, and start a new session in Code.

## Add it in a terminal

In a Claude Code session:

```
/plugin marketplace add lightsabersX2/parival-by-grownoli
/plugin install parival-by-grownoli@grownoli
```

To try it for one session without installing it, clone this repository and run:

```bash
claude --plugin-dir /path/to/parival-by-grownoli
```

## Updates

Each release has a version number, shown in the page's Settings under About, which also says when a newer version exists. You get a new release when you update the plugin, or automatically when automatic updates are on for the marketplace. They are off until you turn them on.

- **Update now.** Run `/plugin`, open the Installed tab, select the plugin and choose Update now.
- **Update automatically.** Run `/plugin`, open the Marketplaces tab, select `grownoli` and turn on auto-update. Claude Code then checks for a new release when a session starts.

## Your first run

Write:

> Make a campaign for example.com

with your own website in place of example.com. Claude asks nothing more unless the campaign is not on the site. A run of two ads in five formats can take half an hour or more. To follow it, ask Claude to show the run, and the page opens with the ads as they are made.

For a walk through every part, one step at a time, write: Take the Parival tour.

## Where your work is kept

Runs are saved in `~/Documents/Ads/runs` unless you name another folder. Each run is plain files: HTML, PNG and notes.

## Statistics and privacy

The local page runs on your computer only, at an address that starts with `127.0.0.1`, and other computers cannot reach it. Your ads, ratings and comments stay on your computer.

Parival sends Grownoli two things:

- **Statistics**, while they are on. They are counts: runs, ads and formats made, how the blind comparisons ended, project files made for Grownoli Studio, how long a run takes, errors by kind, and the versions of Parival, Node and your operating system. The counts carry a random ID made on your computer. The ID is not linked to your name, your email or your Claude account. Parival never sends websites, brand names, ad copy, pictures, file names or comments.
- **A version check**, so that the page can say when a newer version exists. The check carries the plugin's version and nothing else.

The page shows a notice about statistics the first time it opens, and sends no statistics before you have answered it. Turn statistics off there, or later in Settings. Turning them off deletes the ID and sets the counts on your computer back to zero, so turning them on again starts a new ID from nothing. Statistics Report in Settings shows the exact data of the next report, with the ID.

No setting turns the version check off, and the page may make that check before you have seen the notice.

Grownoli stores no IP address with a report or a version check, and deletes an install's ID 25 months after its last report. To have your records deleted sooner, send the ID to hello@grownoli.com before you turn statistics off.

Parival keeps the counts and the switch in `~/.config/parival-by-grownoli`.

Making ads uses Claude Code, which works as your Claude plan describes, and reads the website you name.

## Contributing money

Parival is free. A contribution helps its development and unlocks nothing. Settings has a Contribute button, and the page asks now and then after you have opened a finished run.

## Before you run an ad

The person who runs an ad is responsible for its claims and for the rights to its pictures. Each run comes with a `notes.md` that lists what to approve first.

## Open source, and what is not

Parival by Grownoli is open source under the Apache License 2.0. The parts made by others are listed in `THIRD_PARTY_NOTICES.md`. The names Parival and Grownoli and their logos are reserved, as `TRADEMARKS.md` describes.

Grownoli Studio is a separate product. The Studio is proprietary and hosted at grownoli.com, and the plugin's licence does not cover it. The plugin works without the Studio.

## Help

Write to hello@grownoli.com.

## Changing the local page

The built page is in `skills/local-page/app` and its server in `skills/local-page/scripts/page.mjs`, so nothing needs building to use the plugin. To change the page, edit `page-src`, then run `npm ci` and `npm run build` there. `node --test tests/` runs the tests.
