---
name: nxtfrm-ai-systems
description: NXTFRM AI architecture and safety rules. Use when designing or implementing coaching, summaries, OCR parsing, proposals, model calls, embeddings, or any AI feature in NXTFRM.
---

# NXTFRM AI systems

Supabase is the secure backend and orchestration layer. Generic Supabase security skills still apply.

## Pipeline

raw logs → deterministic calculations → State Engine → phase / events / interventions → structured snapshot → AI

## Authority

- The deterministic engine is truth.
- AI may explain, query, compare, plan, propose, and parse.
- AI must not replace existing calculations or silently mutate important user state.
- Meaningful changes require explicit user approval.
- A proposal states what, why, evidence, and effect. Approved changes become auditable interventions.
- AI should sometimes say nothing. Avoid generic chatbot behaviour.
- Train coaching is short and contextual.
- No fake readiness scores. No fake confidence. AI confidence must not override deterministic data confidence.

## Context and contracts

- Send a compact structured snapshot. Do not dump the full database into every prompt.
- Keep the model provider replaceable.
- Prefer structured JSON contracts over free-form UI generation.
- Log model, proposal, and audit metadata where useful.
- Weekly summaries may be stored for history.

## Data and security

- Secrets live server-side, not in the browser. Call models from Supabase Edge Functions.
- Preserve RLS and user isolation. No service role in the client.
- Numeric history belongs in relational queries, not vector embeddings.
- Embeddings only for semantic retrieval: notes, annotations, summaries, preferences, contextual events.
