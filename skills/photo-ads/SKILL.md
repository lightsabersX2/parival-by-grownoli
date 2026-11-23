---
name: photo-ads
description: Finished ad images built from a brand's own pictures or real photos. Use when asked to make an ad, banner or social post for a business, app or game, with no newly generated pictures.
---

# Photo ads

One finished ad: the brand's own picture or a real photograph, real type and the brand's own look, built as one HTML file and rendered to a PNG. Paths below are relative to this skill's folder. Work in the folder the person names. If they name none and the current folder is temporary or hidden, make `~/Documents/Ads/<brand>/` and work there. Give the full path of each finished image in your last message.

Use any wording you are given letter for letter. When none is given, write it from the site's facts so that a stranger who sees only this ad knows within three seconds what it is and why they would want it. Size defaults to 1080x1080. Make any other choice yourself and note it. Ask only when you cannot tell which business this is for.

A campaign, several ads, or one ad in several formats is a run: use the `campaign-run` skill, which makes each format on purpose and takes it through critique and revision.

Take a brief first, by `references/brief.md`, when the ad is for a campaign, offer or event the brand's site does not state, when the brand has no site or is made up, or when the person asks for help deciding what the ad should say. An ad for what the site already states needs no brief.

When revising an ad, change only what the feedback names: edit the existing `ad.html` with its existing files. Feedback on the background or the photo gets the smallest fix that answers it, such as a larger photo in the same layout, and the copy stays. One owner asked about a background and got new layouts and new copy back. A larger photo in the same layout would have answered the question, and been simpler, quicker and cheaper. Before reworking ads a run already finished, ask whether the work is a new run or part of the old one. Every revision, however small, then goes through the whole look-list in step 4 and the truth check in step 5. A fix that skips the list brings the next complaint.

**Where feedback goes.** The person's feedback on a brand goes in its `brand.md`. Taste that a critic should catch on any brand goes in `references/critic-cases.md`, as a case that stands on its own: the brand, the offer, the headline and supporting line, the scene, and what was wrong, in plain words. No ad numbers or file paths, since old ads are deleted. This file changes only when a blind comparison shows that a new rule for the maker beats the skill without it. Rules added on a hunch tend to be ignored or to flatten the ads.

Keep a `brand.md` in the brand's folder. Read it first if it exists. When the person gives feedback on an ad, add what it teaches about this brand as one short line, in their words where you can, and update any line it overturns. General taste stays out of it unless they say it applies to this brand.

## Steps

1. **Learn the business.** Run `node scripts/render.mjs <website> site.png --size 1280x900 --full` and look at the picture, then read the page code for the exact colours, fonts and logo file. A colour counts as the brand's when you can see it on the page, and it keeps its share: a colour the site uses for a button or a thin band stays that size in the ad. Then study the brand's look in every place it shows itself (method and scoring in `references/brand-study.md`) and write `brand-look.md` in the brand's folder, or read it if it exists. Done when you hold the logo file, any seal the brand's ads must carry, the colours, the shape of the brand's buttons and corners, a font, the usable facts, and the place whose look ranked best.

2. **Choose a picture.** Look first in what the person gave you, then on the brand's own site from the top of the `images` list step 1 prints, then its inner pages. The brand's illustrations and screenshots count as its own. Go to stock (`python3 scripts/photos.py search "<words>" 12`) only when the brand has nothing that suits. Open each candidate at full size and judge it by the Picture rules. Look at the photo's own edges first: a subject the source already cuts (an ear tip, a rump, a tail) stays cut in every crop, so pick another photo or name the cut in `notes.md`. Put every candidate for this message on one contact sheet and compare them there; a small file often has a larger version under a similar name on the same server. Done when one picture passes the Picture and Truth rules and is the most striking the brand has for this message, preferably one where the brand's own idea is in the photo itself. An owner shown a plain conference room asked whether that was really the best picture the brand had. It was not. If none does, build the ad from type and logo and say what real photo would improve it.

3. **Build `ad.html`.** Fixed size, local `<img>` files, `data-role` on every part: `headline`, `text` on a supporting line, `logo`, `hero`, `seal`, and `cta` on a drawn button if the ad has one. **Compose on purpose:** read `references/composition.md`, then choose a framing (detail, close-up, mid, environmental, wide) and a structure (diagonal, leading lines, S-curve, L, V, pyramid, pattern interrupt and the rest) and write both in `notes.md` with the reason. The habit, a mid-distance subject in the middle and a band of words beside it, is set aside first. Crop the photo three ways before settling. For paid social, start from a concept in `references/static-ad-concepts.md`. Done when every rule under Words, Type, Picture and Parts holds.

4. **Render and take every look.** Run `node scripts/render.mjs ad.html final.png --size 1080x1080` (add `--older` for an older audience, and `--seal` when the brand's ads must carry a seal) and fix what it reports. Make the phone view with `sips -Z 390 final.png --out phone.png`. Then take the seven looks below, one at a time, each with the picture open, and write one line per look in `notes.md` saying what you saw. A look that finds something sends you back to step 3, and the list starts again from the top. Done when all seven lines are written for the final render and none names a fault. Before the first render, the headlines go to a critic who did not write them and has not seen the brief, who says what problem each one solves at a glance. Before the owner sees a set, a fresh critic (a subagent given only the PNGs and a brief) looks for the same faults and judges the set against the cases in `references/critic-cases.md`. That file is for critics only, so the maker hands it over unread. Tell it what the platform supplies, such as the button and the phone number, so it does not report their absence.

   1. **Stranger.** Someone who has never heard of the brand: in three seconds, who is this from, what is it, why would I want it?
   2. **Phone.** In `phone.png`, can a 70-year-old read every line without effort, in daylight? Is the headline the largest thing after the picture?
   3. **Line breaks.** Read each line of the headline alone. Does each end where a phrase ends?
   4. **Hero and composition.** Is the subject whole and untouched by words, labels and logo? Can you see the framing and structure named in the notes, and do the picture's lines lead to the subject or the words?
   5. **Parts.** Logo free, seal present, corners the brand's, nothing drawn that looks pressable without reason.
   6. **Edges and gaps.** Follow the four edges and every gap between parts: anything cut, touching, dangling or pointing at nothing?
   7. **Set.** Beside the brand's other ads: a different picture, and a different pair of framing and structure?

5. **Check the truth and write `notes.md`.** Read the words in the PNG, not in the HTML, which can hold text the picture hides. List the photo's source and credit, every word nobody supplied and where it came from, and anything the person should approve. For a stock photo, run `python3 scripts/photos.py use <id>` and copy its credit. Done when each Truth rule is answered in the notes.

Hand over `final.png`, `ad.html` and `notes.md`, and name anything in the notes that needs approval. When several exported ads share a photo, the file names say so: motif, a version letter, the goal and the headline (`Roses A - Delivery - Bouquets delivered the same day.png`, `Roses B - ...`). A number alone tells the owner nothing.

## Words

- **Plain sentences.** Write the headline the way a person would say it, naming the audience's situation or the outcome. A site's line is a source of facts: rewrite any with slogan rhythm, such as stacked fragments, "not X, but Y" or a set of three.
- **For a stranger.** The headline works for someone who was not thinking of the brand and does not know the subject: the species, the product, the place. A plain fact about the organisation is not a hook, and a result alone is no reason to act. Tell the short story: what is at stake, what the brand does about it, the proof, the ask. A wildlife trust's ad that only reported a record count of a rare owl gave a stranger no reason to join.
- **One message.** One headline, at most one short supporting line. Each extra element must be the idea of the ad, or it goes.
- **The ask is one firm sentence.** "Join for £4 a month." No "if you like", no optional extra bolted on: "and add a monthly gift if you want to" was turned down as slack.
- **Say the action in words.** A feed ad gets the platform's real button under the picture, so the picture states the action as a line of text ("Join from £4 a month.").

## Type

- **Readable on a phone.** A 1080 px ad is about 390 points wide in a feed. The headline and the supporting line are at least a 24th of the ad's width in font size (45 px, 16 points) and nothing else is under a 30th (36 px). When the audience is older, as for most charities and member organisations, render with `--older`: a 20th (54 px, 19.5 points) and a 27th (40 px), the size guidance for older readers points to (health.gov: 19 px or 14 points; 95% in one phone study preferred 20 px). A line that does not earn that size goes. `render.mjs` reports smaller text.
- **Contrast you can read in sunlight.** Dark text sits on a light ground and light text on a dark one, at 7 to 1 or better. Text over a mid-tone photo gets the brand's highlight behind it or moves. Black on a fairly dark background fails. `render.mjs` measures each text against the pixels behind it and reports any under 7 to 1.
- **No wall of text.** A headline over about twelve words is cut before it is set. In a longer line, set the two or three words that carry the point in bold so the eye has somewhere to land.
- **Break lines by sense.** Set every line break by hand. A line ends where a phrase ends, and a preposition or adverb opens the next line with the words it belongs to: "We look after the woods / close to where you live", never "…the woods close / to where you live". Lines in a block are close in length. The browser's wrap decides nothing.
- **The highlight colour means something.** Green says safe, calm, nature; a threat or a warning on green is a contradiction the viewer feels before reading. Mark a threat with the brand's warning colour and good news with its calm one.
- **One size per headline.** A headline in three sizes and two colours reads as amateur. Emphasis comes from weight or the brand's highlight colour on the words that carry the point, never from a third size.
- **Breathing room.** Logo, words and seal stay at least 80 px from every edge and 32 px from each other, with far more wherever there is space. Only the picture runs to the edge.

## Picture

- **Found, not staged.** Posed strangers, high fives and models in a sunset read as stock. A person seen from behind is a weak subject. Look for a colour cast before you commit.
- **The hero always gets its space.** Give the best picture real size, and keep every word, label and logo clear of its subject, wing tips and whiskers included. No head, ear, beak or wing tip is cut by the ad's edge or hidden behind a panel; when a square crop cannot hold the subject, show the whole photo as a band and put the words on the ground colour beside it.
- **Framing and structure are chosen, never defaulted.** A set that is all mid-distance subjects on a third line is boring however good each photo is. The lists and when to use each are in `references/composition.md`.
- **Leading lines run into the picture.** A road, a shore, a branch or a gaze starts at an edge and leads the eye inward, to the subject or to the words. Crop so the line's start is visible and its end stays inside the frame. Words never sit on the start of the line.
- **Light carries the mood.** A dark area inside a bright, happy photo is fine. A dark panel or overlay laid over a photo is gloomy. Where words need help on a busy photo, use a soft gradient in the photo's own tone.
- **The ground colour comes from the brand's ads, not only its site.** A site's section colour (a cream panel, a tinted gradient) put behind every ad of a set reads as foreign to the people who run the brand's ads. One brand's own team said of a set all on the site's cream that the colour was unusual for their ads.
- **The brand's best place is the floor.** Take logo, font and exact colours from the site, look and tone from the place that ranked best in `brand-look.md`, and the composition from the picture and the message. Rebuilding a section of the site is a template, not an idea.
- **Real proof.** When the brand has a customer quote, press or a true before and after, consider building the ad around it. Never invent any.

## Parts

- **One human touch.** An ad of aligned boxes and nothing else reads as machine-made, however tidy. Give it one thing a designer's hand would add, taken from the brand's own look: a label set slightly askew, type crossing the photo's edge, a number that is the picture. An owner said of a tidy set that it lacked any personality. A tilt suits a light or festive message only; on a serious subject it reads as play, as a tilted highlight did in an invitation to a public meeting about a planned quarry.
- **The logo stands free,** once, straight on the picture or the ground colour. No box behind it.
- **The seal the brand's ads must carry** (a charity seal, a licence mark) is on every ad its rule covers. Read the issuer's own rule for its scope: a fundraising regulator's badge belongs on ads that ask for money, not on an event invitation.
- **The brand's own shapes.** Corners and frames copy the site: square where the site is square.
- **Drawn buttons: some, not all.** A feed ad already gets the platform's real button, so a drawn button that dominates an ad without need looks fake. A square highlight behind words reads as text and is fine. Buttons that share one colour and one rounded shape across a set read as a template, so a button takes the brand's own shape and varies across a set. Removing them all is the opposite fault: one owner lost every drawn button and offer pill from seven brands at once and wanted them back. A button or offer pill an ad already has stays unless a pin on that ad names it.

## Sets

- **Each ad its own picture and shape.** In a set, change where the type sits, how big it is against the picture and how the picture is cropped. Put the set side by side before handing over; if it reads as one layout resized, redo the weakest. Two sets were turned down because they looked like slide templates.
- **One image treatment per set.** A photo stays a photo on every card: a rectangle with crisp edges and its own background. A cut-out, or a photo faded into flat colour, reads as an illustration; mix the two in one set and it looks like two campaigns.
- **A carousel is one series.** Every card has the same form: where the photo sits, where the words sit, where the logo sits. Compare two versions as whole strips; judged card by card, each card wins in a different form and the series falls apart.
- **One daylight across a carousel.** Side by side, the photos look as if they were taken in the same light: match brightness and contrast first, and drop a photo that cannot match or is soft at full size. Each card also hands the next one a reason; a card that only states a fact ("animals are shy") earns a "so what?".
- **No phrase twice in a row.** Read the set's headlines in order, aloud. A phrase that ends one ad ("i vinter") does not end the next.
- **The price in the ads is the price the campaign wants.** When the brand hopes for more than its lowest price, some ads ask for the higher amount from the start and say what it is made of.

## Truth rules

A photo in an ad is a claim, because viewers assume it shows this business.

- **Own things need own photos.** When the wording points at the business's own shop, vehicles, animals, staff or work, use the business's own photo. A stock photo may stay only if it shows nothing a viewer could take for a specific place, vehicle, animal or person: a material, a detail, hands at work.
- **No disclaimer about the picture in the ad.** "The forest in the picture is an example" tells the viewer the ad needs excusing. Use a picture that claims nothing it cannot back (a texture, a detail, the brand's own photo) or change the words, and keep the photo's source in `notes.md`.
- **Other firms' marks disqualify a photo.** Choose photos free of other firms' names, logos, plates and labels. Painting marks out or blurring faces does not repair a photo, so move on to another.
- **Facts come from the brief or the business's own site.** Prices, numbers, ratings and quotes appear only when one of those states them.
- **A cause needs a source that states the cause.** Viewers read two facts placed together, such as the same year, the same place or a number beside the logo, as cause and effect. Place them together only when a source says one led to the other; a shared date is correlation, and the ad says nothing about it. A walking association's ad said "The coast path opened the year we were founded". That was true, but it implied the association made the path. When the only source for a cause is the advertiser's own material ("thanks to our work"), say so in `notes.md`.
- **Unearmarked money stays unearmarked.** Money a donor cannot direct is described the way the brand does ("goes towards, among other things"), never as a gift to one cause.
- **The sums add up for a stranger.** When an offer leans on another amount, such as an allowance, a deduction or a discount, the ad states that amount and the price fits inside its real limit. One ad for a Pilates studio sold a pass of 50 classes for £825 as a way to spend an employer's wellness allowance that stops at £500 a year.
- **The photo shows the place the words name.** When the ad names a city, area or place, the photo shows that place so a local recognises it at a glance: a landmark, a known street, the waterfront. A skyline, an aerial or a room that could be any city is wrong. Ads that named a harbour city were turned down for an aerial nobody could place and a grid of interiors, since neither showed the city.
- **Local beats generic.** Search the brand's own city or neighbourhood first, and say in `notes.md` where a stock photo was taken. Buildings, streets and rooms are the most sensitive: show only the brand's own area, and never a place a viewer could take for the business itself.
- **Identifiable people in stock photos are a risk.** The licence does not promise model releases, so prefer photos without recognisable faces and flag any that remain.

## Photo search setup

`photos.py` needs `UNSPLASH_ACCESS_KEY`, from the environment, from a file named by `PHOTO_ADS_ENV`, or from `.env` in the current folder. Without a key, say that stock search is off and use the person's or the website's photos. Unsplash's API terms expect hotlinked images, which a PNG cannot do, so check them before using this in a product.
