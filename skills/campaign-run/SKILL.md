---
name: campaign-run
description: A whole run of ads for one brand. Several ads, each in five formats, each through up to three loops of blind critique and revision, shown on a local page. Use when asked for a campaign, a set of ads, ads in several formats, or a run.
---

# Campaign run

A **run** is one campaign for one brand: two or more ads, each made in the five formats Grownoli Studio opens, each taken through at most three **loops** of blind critique and revision. Paths below are relative to this skill's folder. The sibling skill `../photo-ads/SKILL.md` holds how one ad is made and every rule an ad must meet. Read it before step 1 and follow its Words, Type, Picture, Parts, Sets and Truth rules for every ad here.

One ad alone is `photo-ads` work, not a run.

## The folders

`scripts/run.mjs` keeps the folders, so use it instead of making or moving loop folders by hand. Run `node scripts/run.mjs` with no command to list its commands.

```
<runs>/<date>-<campaign>/<company>/        the set
  briefs.json  notes.md  brand.md  brand-look.md  assets/
  <size>-<ad>/loop-<n>/ad.html  ad.png  critique.json
  <size>-<ad>/rejected/loop-<n>/           a revision that lost its blind judgement
```

`<runs>` is the folder the person names, or `~/Documents/Ads/runs`. `<size>` is `1x1`, `3x4`, `9x16`, `16x9` or `4x3`, rendered at 1080x1080, 1080x1440, 1080x1920, 1920x1080 and 1440x1080. `<ad>` is a short name for the ad's idea, such as `open-house`. Each `ad.html` loads its pictures, logo and fonts from `../../assets/`.

## Steps

1. **Learn the business and choose the campaign.** Do steps 1 and 2 of `photo-ads` once for the brand: the site, the look, the pictures. When the campaign is not on the site, take the brief by `../photo-ads/references/brief.md` first. Then run `node scripts/run.mjs new <runs> <company> <campaign>`, with the campaign's name as the person or the brief gave it, since the page shows it as the run's title, and keep `brand.md`, `brand-look.md` and every picture, logo and font file in the set it prints. Done when the set folder holds the logo, the fonts and at least one picture per ad.

2. **Plan the ads.** Choose how many ads the campaign needs: two unless the person asks for more. Each ad has its own message, its own picture and its own headline. Write `briefs.json` in the set, one entry per format of every ad:

   ```json
   [{ "format": "1x1-open-house", "brand": "…", "sells": "…", "goal": "…", "audience": "…", "language": "…",
      "headline": "…", "subheadline": "…", "cta": "…", "platform_supplies": "the platform's own button and the advertiser's name",
      "aim": "breadth: each format has its own idea", "photo_source_url": "…" }]
   ```

   The five formats of one ad share its headline and facts. Two facts on one line are joined by a comma or set on two lines, never by a middle dot or a bullet. `older: true` or `seal: true` on an entry renders that format with the matching check. Leave out a key the ad does not have. Done when every ad has five entries and the copy in them is final.

3. **First reader.** Before anything is built, start one fresh subagent and give it only the kind of business, the channel and the headlines, with none of your reasoning. Ask two things: what problem each headline solves at a glance, and whether a stranger who meets this subject in a feed would feel watched or be reached at a bad moment, such as a death, illness, debt, divorce or infertility. A headline whose problem it cannot name is rewritten. A yes on the second question keeps that ad out of feed formats; tell the person and plan another ad. Done when both answers are in `notes.md`.

4. **Build loop 1.** For every format, write `<size>-<ad>/loop-1/ad.html` by step 3 of `photo-ads`. **Each format is composed on purpose.** An ad imported into Grownoli Studio does not adapt when its format is changed there, so the five formats are five layouts: choose the crop, where the words sit and how large they are for each shape, and write the pair of framing and structure per format in `notes.md`. A layout stretched to five shapes is the fault this step exists to prevent. Then run `node scripts/run.mjs render <set>`, fix every fault it reports and render again. Open each `ad.png` and take the seven looks of `photo-ads` step 4. Done when the render reports no fault and you have looked at all the pictures side by side.

5. **Critique.** Run `node scripts/run.mjs critique <set>`. It stages one folder per ad and prints one prompt per folder. Start one fresh subagent per prompt, all in one message, on Sonnet when the plan has it, and give each exactly the printed prompt and nothing more: the critics are **blind** to your reasoning, your notes and each other. Then run `node scripts/run.mjs critique-apply <set>`. Done when it files a critique for every staged format.

6. **Revise.** Run `node scripts/run.mjs revise <set>`. It starts the next loop for every format that is neither locked nor out of loops, copies its `ad.html` and prints the defects to fix. Fix each named defect inside the ad's own concept, by the revising rule in `photo-ads`: the smallest change that answers it, the copy kept. A defect about the whole ad, such as a layout any template would produce, is answered by a new layout with the same picture and copy. Add no device the critic proposed. Decline a defect only when a truth rule, platform policy or the person's own words forbid the fix, and write it in `notes.md` under the heading Declined with that reason. Render, and fix what the render reports. Done when every open format has a new `ad.png` and every defect is fixed or declined.

7. **Judge.** Run `node scripts/run.mjs judge <set>`, start one fresh subagent per printed prompt on the session's own model, then run `node scripts/run.mjs judge-apply <set>`. The judge sees each revision beside the version before it, unlabelled, with the sides drawn by lot. A revision that does not win moves to `rejected/` and still counts as one of the format's three loops. Done when every staged pair has its verdict filed.

8. **Repeat.** Do steps 5 to 7 until `node scripts/run.mjs status <set>` prints `"done": true`. Its `next` line names the next command at every point. A format is **locked** when its newest critic scored every line 4 or more and named no defect; it stays as it is. Every other format gets three loops and no fourth: more loops happen only when the person asks, one at a time. The critique of a format's last version is a measurement. Nothing acts on it.

9. **Check the truth and write `notes.md`.** Do step 5 of `photo-ads` for the set: each picture's source and credit, every word nobody supplied, what the person should approve, the framing and structure per format, and the defects declined. Done when each Truth rule is answered.

10. **Show the run.** Open the local page with the `local-page` skill, pointed at `<runs>`. Tell the person that each ad's loops are side by side there, that they can rate and comment, and that you will read what they write. Give the page's address and the set's full path. Done when the page is open on this run.

## After the person has looked

Read their ratings and comments with the `local-page` skill. A star locks that version. A thumbs up says to build on it. A thumbs down says to move away from it. A comment pinned to a spot names what to change there. Change only what a comment names, as one new loop for that format: `node scripts/run.mjs revise <set> <format>` starts it. Render it and say which formats changed. A loop the person asked for answers their own words, so it gets no critic and no judge. Before reworking a run that is finished, ask whether the work is a new run or new versions in this one.

## Exporting

Each kept `ad.html` exports to Grownoli Studio with the `studio-export` skill, one project file per format.
