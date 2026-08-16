# Smart Syllabus Visualizer

Upload your course syllabi (PDF/DOCX). AI extracts every deadline, exam, and grading
weight into one color-coded semester timeline — with a human review step for anything
it wasn't sure about.

## Quick start

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, optionally OPENAI_API_KEY
npm run db:push        # create tables (uses a dedicated `syllabus_v2` Postgres schema)
npm run db:seed        # optional: demo data — sign in as demo@student.edu
npm run dev
```

No `OPENAI_API_KEY`? The app automatically runs a deterministic **mock extractor**
(regex-based, offline) so the entire flow — upload, review, timeline, export — is
demoable with zero credentials and zero spend. Set `MOCK_AI=true` to force it.

```bash
npm test          # unit + pipeline tests (node:test, no network)
npm run typecheck # strict TypeScript
npm run build     # production build
```

Try it: sign in with any email, create a semester (e.g. 2026-09-08 → 2026-12-18),
and drag in `tests/fixtures/cs348-syllabus.txt` on the upload screen.

## How it works

```
 file ──► parse (pdf-parse / mammoth / OCR-flag) ──► raw text (persisted)
      ──► LLM extraction (OpenAI Structured Outputs, JSON-schema enforced)
      ──► Zod re-validation
      ──► normalization layer:
            · "Week N" → real date via semester start
            · out-of-term dates dropped, raw text kept
            · duplicate collapse, weight-sum sanity check
            · confidence routing: HIGH → timeline, MEDIUM/LOW → review queue
      ──► human Review & Confirm ──► dashboard / .ics export
```

## Engineering decisions worth asking about

1. **Schema-enforced LLM output.** Extraction uses `response_format: json_schema`
   with `strict: true` — the API guarantees the shape. A Zod layer then re-validates
   semantics (enum values, ISO dates, weight ranges) and produces typed objects.
   Two layers because a schema can't express "this string must be a real date".

2. **The model never resolves relative dates.** The prompt explicitly forbids it from
   guessing what "Week 8" means; it returns `weekNumber` instead. Only the app knows
   the true semester calendar (`lib/dates.ts:resolveWeekNumber`), so resolution is
   deterministic and testable rather than a hallucination surface.

3. **Confidence is a routing decision, not a label.** HIGH + dated → straight to the
   timeline. Anything else → review queue, where the user sees the *verbatim* syllabus
   text next to the AI's guess. `rawDateText` is never overwritten, so every date on
   the timeline is auditable back to its source.

4. **Raw data ≠ confirmed data.** The `Syllabus` model keeps the full extracted text
   (re-runnable, auditable); `Event` keeps `rawDateText`, `confidence`, `needsReview`,
   and a separate `confirmed` flag for human sign-off.

5. **Calendar dates, not instants.** All dates are stored as UTC midnight and rendered
   through explicit UTC↔local converters, so a deadline never shifts a day depending
   on the viewer's timezone.

6. **Multi-format ingestion with honest failure.** Text PDFs via pdf-parse, DOCX via
   mammoth, and a <200 chars/page heuristic flags scanned PDFs. OCR sits behind an
   `OcrProvider` interface and an `ENABLE_OCR` flag (tesseract.js is ~30MB of WASM and
   30s+/page — wrong default for a request path; the interface swaps to hosted OCR
   without touching callers). Users get a clear "this looks like a scan" error instead
   of silent garbage.

7. **Swappable auth.** A minimal signed-cookie session lives entirely in `lib/auth.ts`;
   the rest of the app only calls `getCurrentUser`/`requireUser`, so Clerk or NextAuth
   is a one-file change.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind + shadcn-style primitives ·
Prisma + PostgreSQL (Neon) · OpenAI gpt-4o structured outputs · pdf-parse / mammoth ·
`ics` export · date-fns · lucide-react

## Structure

```
app/                  pages + API routes (upload, extract, courses, events, export.ics)
components/timeline/  custom div-based Gantt timeline, list view, this-week panel
components/upload/    drag-drop zone with per-file processing states
components/review/    review & confirm queue
lib/                  ai.ts · parser.ts · normalize.ts · dates.ts · ics.ts · auth.ts
prisma/               schema + seed
tests/                node:test suites + syllabus fixtures
```

## Deliberately out of scope

AI study recommendations, session scheduling, grade calculator, notifications,
semester sharing, multi-semester comparison.
