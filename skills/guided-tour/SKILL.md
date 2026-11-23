---
name: guided-tour
description: A guided first run of Parival by Grownoli, one step at a time, from a website to a reviewed run and an ad opened in Grownoli Studio. Use when the person asks for the Parival tour, a walkthrough, or help getting started with Parival.
---

# Guided tour

You take one person through the whole of Parival for the first time: a run of ads from their website, the local page where they rate and comment, a revision from their comments, and one ad opened in Grownoli Studio. The person types and clicks. Every command is yours to run. Speak the person's language, in short plain sentences, one step at a time, and wait for their word before the next step.

## Steps

1. **Open.** Say in four lines what will happen: a campaign of two ads in five formats from their website, a page on their own computer where they rate and comment, a revision from what they wrote, and one ad opened and changed in Grownoli Studio. Say that the run takes a while and that they can follow it on the page.

2. **Check the computer.** Run `node --version` and look for Chrome, Chromium, Edge or Brave. Node 22 or later and one of those browsers are needed. When something is missing, say what it is in one sentence and ask before installing anything. Done when both are present.

3. **Start the run and open the page.** Ask for the person's website and nothing else. Start a run with the `campaign-run` skill in `~/Documents/Ads/runs`: two ads, five formats. As soon as the set's folder exists, open the local page with the `local-page` skill and say that the ads appear there as they are made. Done when the page is open in the person's browser.

4. **Finish the run.** Take the run through its loops by the `campaign-run` skill, and say in one line when each loop ends. Done when its status command prints `"done": true`.

5. **Review together.** Ask the person to do three things on the page and to say when they are done: give one ad a thumbs up or a thumbs down, write a note on one ad about something to change, and click a spot on one picture to comment on it. Point out Compare Versions, which shows every loop of an ad side by side. When the person is stuck, ask what they see. Done when they say they are finished.

6. **Read the comments and revise.** Read what they left with the `local-page` skill, tell them comment by comment what you read, and revise the formats their comments name. Done when the new versions show on the page and the person has looked.

7. **Export one ad.** Ask which ad and format they like best, export it with the `studio-export` skill and show the ZIP in the file manager. Done when the person sees the file.

8. **Open it in the Studio.** Grownoli Studio is a separate hosted product at grownoli.com and needs an account. Ask whether they want this step. You cannot see their browser, so give one instruction at a time:
   1. Go to grownoli.com and open the Studio.
   2. Create an account, or sign in.
   3. Click Templates in the top bar, choose the Mine tab, click Import and pick the ZIP.
   4. Change the headline.
   5. Change the background colour, when the ad has a plain ground.
   6. Export the ad.

   Done when they have exported, skipped the step, or say they cannot get further.

9. **Close.** Say where the run is saved, how to ask for the next campaign, and that questions and faults go to hello@grownoli.com. Offer to write a short note of anything that went wrong during the tour, for the person to send themselves if they want to. Send nothing yourself.
