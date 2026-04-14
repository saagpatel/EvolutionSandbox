# Accessibility Notes

## Interaction ownership

The app is intentionally not trying to make the canvas itself a full keyboard widget.

The accessible interaction model is:

- global navigation
  - skip link to the active main content region
- surface switcher
  - tabs semantics with left/right plus Home/End support
- creature inspection
  - roster as the canonical keyboard selection surface
- timeline
  - native range input plus focusable event markers with explicit labels
- inspector
  - textual explanation of the selected creature
- analytics
  - visible text summary alongside visual charts

## Live announcements

The app uses a polite live region for important changes only:

- current notice changes
- baseline selected or cleared
- selected generation changes from explicit user action
- selected creature changes
- run completion
- import review and import result changes

The app avoids announcing every internal simulation tick.

## Canvas posture

The phenotype field remains a visual surface.

Accessibility support comes from:

- clear labeling
- description text that points users to the roster and inspector
- reduced-motion behavior
- inspector text that explains where the selected creature sits in the field

## Reduced motion

When `prefers-reduced-motion: reduce` is active:

- the phenotype field stops ambient animation
- the population field still renders the same information statically

## What to verify before ship

- keyboard-only flow can:
  - skip repeated top-level chrome
  - move across surfaces
  - inspect creatures
  - scrub generations
  - save and compare runs
- visible focus is obvious on tabs, buttons, inputs, and roster options
- notices and important state changes are announced without becoming noisy
- chart takeaways are available in text, not only graph form
- import review can be completed and dismissed without a mouse
- automated accessibility smoke stays green in unit tests before the manual screen-reader pass
