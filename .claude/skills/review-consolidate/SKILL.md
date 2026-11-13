---
name: review-consolidate
description: Turn a Review Page export (the "Export for AI" text or JSON of frame comments on an END Properties video) into one clear change list, resolve conflicts with the decider's word, and propose reusable feedback rules. Use when the user pastes a Review Page export or asks to consolidate video review comments.
---

# Review consolidate

Input: the text or JSON from the Review Page **Export for AI** button. Each comment has a number, a time (`m:ss.s`), a position on the frame (x/y in % from top-left), the author, their role (`admin`, `decider`, `reviewer`), a status (`open` / `resolved`) and the text.

## Steps

1. **Skip resolved comments.** List them at the end under "Already resolved" with their numbers only.
2. **Group open comments that ask for the same change.** Same moment (within ~1 s) and same area of the frame, or the same request in different words, count as one change.
3. **Find conflicts.** Two comments conflict when following one makes the other impossible (e.g. "shorter scene" vs "add more detail to this scene"). The `decider` (Dion) has the final say. If no decider commented on that point, mark it **Needs decision** and do not choose.
4. **Write the change list** in video order. One line per change, written as an instruction the video editor or the Remotion pipeline can act on directly:
   - `[0:03.2–0:04.0] Price card (center-left): change the price to AED 1.2M` — source: #1 (Dion)
   - Name the on-screen element when the position makes it clear (title, price card, logo, CTA, end card, subtitles).
   - Keep the reviewer's numbers and wording for facts (prices, names, dates). Never invent facts.
5. **Flag anything risky:** a requested change that removes the Trakheesi number or QR code, adds a claim like "guaranteed return", or changes a price/payment plan without a source. Put these under **Check before applying**.
6. **Propose feedback rules.** If a comment expresses a lasting preference rather than a one-off fix (e.g. "logo always top right", "price in AED and EUR", "never say luxury"), propose it as a rule for future videos. Mark each as *proposed*; a human approves it.

## Output format (in the language of the comments; Albanian if mixed)

```
## Ndryshimet për v{N} — {title}
1. [time] element: instruction — burimi: #n (author)
...

## Duhet vendim
- #a (author) kundër #b (author): what conflicts, and the two options

## Kontrollo para se ta aplikosh
- ...

## Rregulla të propozuara për memorien e feedback-ut
- "rule" — nga #n (author)

## Të rregulluara tashmë
#n, #m
```

Keep it short. No commentary beyond what helps the editor act.
