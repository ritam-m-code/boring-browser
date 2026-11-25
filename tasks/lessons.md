# Lessons

Corrections and the rules derived from them.

## Commit to a visual identity, don't approximate it

**Correction (2026-11-24):** Phase 0 shipped a "dark dashboard with red accents and
lightly cut corners" and the response was *"its not screaming persona 5 to me."*

**Why it happened:** I implemented the *palette* of the reference (black/red/white,
diagonals, halftone) but none of its *signature devices*. A strong visual identity is
carried by two or three specific, nameable mechanisms, not by colour choice. For P5 those
were: misregistration (hard offset colour copy behind each panel), white/cream slabs as
structure rather than white-as-text-colour, genuinely jagged many-vertex silhouettes, and
tilt large enough to read as deliberate (~3deg, not ~1deg).

**How to apply:** When the brief names a strong reference, list its signature mechanisms
explicitly BEFORE writing CSS, and implement them at full strength. A timid version of a
loud aesthetic reads as a bug, not as restraint. If worried it's too much, build it bold
and tune down from a render - tuning up from timid takes an extra round trip.

## Show rendered options, don't describe them

Three rounds of this phase were resolved in minutes by rendering comparison sheets
(colour treatments, nine font specimens in context, three days of collage) and asking
which, rather than describing options in prose. `tools/mock.html` + headless Chrome is
now the standard move for any visual decision.

## clip-path clips the output of filter

`filter: drop-shadow()` on an element that also has `clip-path` produces nothing visible:
the shadow is generated and then clipped away by the element's own silhouette. The filter
must go on an unclipped ancestor, which then traces the clipped child correctly.
Cost me a wrong diagnosis ("contrast/scale problem") before I checked computed styles.
