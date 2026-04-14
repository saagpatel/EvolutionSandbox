# Screen Reader Close-Out Checklist

Use this checklist for the final human-only accessibility proof on the deployed app.

Run it on:

- macOS with VoiceOver, or
- Windows with NVDA

Preferred target:

- [https://evolutionsandbox.vercel.app](https://evolutionsandbox.vercel.app)

## Pass rule

Call the screen-reader pass complete only if:

- every required step below is understandable without guesswork
- no major state change is silent
- no repeated announcement becomes distracting or unusable
- no critical workflow depends on the canvas alone

If a step fails, record:

- the exact step
- what was announced
- what should have been announced
- whether it is a blocker or should-fix

## Setup

1. Open the deployed app in a clean browser session.
2. Turn on the screen reader.
3. Keep the keyboard only. Do not use the mouse unless a step explicitly calls for it.

## Required checks

### 1. Entry and navigation

Steps:

1. Land on the page.
2. Move to the first interactive element.
3. Confirm the skip link is discoverable.
4. Move through the workspace tabs.
5. Use left/right arrows.
6. Use `Home` and `End`.

Expected:

- the skip link is announced clearly
- the active tab is announced as selected
- switching surfaces is understandable from announcements alone

### 2. Sandbox understanding

Steps:

1. Stay on `Sandbox`.
2. Read the quickstart panel.
3. Read the baseline panel.
4. Read the generation summary.
5. Move through the diversity and pressure sections.

Expected:

- the quickstart text makes sense without seeing the layout
- the baseline state is clear
- the right-side explanation panels are understandable without the canvas

### 3. Timeline and generation changes

Steps:

1. Focus the timeline range input.
2. Change generations with the keyboard.
3. Move to one event marker and activate it.

Expected:

- generation changes are announced
- the event marker labels are understandable
- announcements are informative but not noisy

### 4. Creature inspection

Steps:

1. Focus the creature roster.
2. Move through creatures.
3. Select one creature.
4. Clear selection if possible.
5. Read the inspector.

Expected:

- roster options are announced as selectable items
- selected creature changes are announced clearly
- the inspector explains the creature without requiring the canvas

### 5. Run and baseline flow

Steps:

1. Run a scenario to completion, or fast-forward first if preferred.
2. Save the experiment.
3. Open `Lab`.
4. Confirm the saved experiment can be found and marked as baseline.
5. Return to `Sandbox`.
6. Compare against the baseline.

Expected:

- run completion is announced
- saving and baseline selection are announced
- comparison mode is understandable from the text panels

### 6. Import review flow

Steps:

1. Open `Scenarios`.
2. Import one example scenario file.
3. Read the import review.
4. Cancel it.
5. Repeat and confirm it.
6. Open `Lab`.
7. Import one example experiment file.

Expected:

- the review step explains what the file will do
- blocked or duplicate outcomes are understandable
- focus returns to a sensible place after canceling or closing
- importing does not feel ambiguous

### 7. Reduced-motion sanity check

Steps:

1. Turn on the OS/browser reduced-motion preference.
2. Reopen the app.
3. Read and inspect the Sandbox again.

Expected:

- nothing important becomes harder to understand
- the visual field still has adequate text alternatives

## Result template

Date:

Environment:

Screen reader:

Outcome:
- pass
- pass with follow-ups
- fail

Findings:
- none
- or list each finding with blocker / should-fix

Next action:
