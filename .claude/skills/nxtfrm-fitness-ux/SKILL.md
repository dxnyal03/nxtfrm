---
name: nxtfrm-fitness-ux
description: NXTFRM fitness product semantics for training, body, cut, and recovery. Use when designing or implementing splits, sessions, set logging, substitutions, weight, cardio, scans, phases, or coaching copy.
---

# NXTFRM fitness UX

Use real training semantics. Do not invent metrics or scores.

## Training model

- Respect split/day structure and Gym A/B context.
- Workout queue and session progression stay attached to the planned day.
- Distinguish working sets from warm-up sets.
- Log load, reps, and RIR against previous performance. Double progression is the progression model.
- Rest timer and set logging belong to the current set.
- Exercise substitutions are explicit. Optional add-on lifting must not overwrite planned day semantics.
- Rest, Zone2, and Floorball days keep their own meaning.

## Weights and context

- Morning weight is canonical. Post-workout weight is contextual.
- Cardio targets, recovery inputs, body measurements, and scans are separate inputs.
- Cut context means preserve strength and performance during the cut.
- Phases, interventions, events, and annotations are first-class. Respect confidence and data sufficiency.
- Minimum necessary intervention. No silent programming changes.

## Train

- Current set is the protagonist.
- Coaching copy is concise. No motivational fluff. No fake readiness score.
- Queue can live in a sheet or contextual layer.
- Session completion summarizes real outcomes.

## Body Intelligence

- The Body surface is a page/dashboard, not an “OCR scanner”.
- OCR is Add body scan: capture → OCR → review → correct → save.
- Low-confidence OCR fields require review.
- Compare scans and show body trends.
- Distinguish direct measurements from estimates.
- No fake body score.
