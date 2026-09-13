# How this mock generates questions

This file describes the **item pipeline** for a new enhanced TOEFL iBT paper in this repo. It is not an ETS document. Official ETS items and the copyrighted Official Guide PDF are **not** used as source text.

**Allowed references**

- `doc/TOEFL_iBT_Comprehensive_Guide.pdf` (structure and task types only)
- `doc/TOEFL iBT Academic Subjects and Vocabulary Topics.pdf`
- `content/constraints/exam-blueprint.md`
- `content/constraints/subjects-vocab.md`
- `content/constraints/rubrics.md`

**What “Start new test” means**

- **New test** (`/api/generate`) always builds a **new form** for that student: new IDs, a new `TestForm` row, and a selection that prefers items the student has not seen.
- With an LLM key, the system also **writes a new batch of original items** before the paper is assembled, then saves accepted items to `data/item-bank.json`.
- **Retake** and **Redo** reuse an existing form on purpose (same questions, new sitting). That is not a new test.

---

## End-to-end pipeline

```
Student clicks Start new test
        │
        ▼
createNewTest(userId, difficulty)          lib/sessions.ts
        │
        ▼
generateFormPayload(difficulty, userId)    lib/generation/index.ts
        │
        ├─ Load this student's seen fingerprints
        │     data/seen-items.json
        │     if empty, backfill from that user's stored TestForm payloads
        │
        ├─ Load grown bank
        │     data/item-bank.json  +  handmade seeds in bank-*.ts
        │
        ├─ Assemble a valid local paper (avoid seen items when extras exist)
        │
        ├─ If GEMINI_API_KEY or OPENAI_API_KEY is set
        │     ├─ createFreshItems()   parallel LLM batches  lib/generation/llm-create.ts
        │     │     retrieve subjects/campus cues from vocab-pack.ts
        │     │     validate each seed in item-checks.ts
        │     │     keep any item that passes (partial batches are OK)
        │     ├─ appendGrownBank()    save extras to item-bank.json
        │     ├─ assemble again, preferring the newest extras
        │     └─ enrichWithLlm()      rewrite email + academic discussion
        │
        ├─ validateForm()             counts, CTW rules, M1 vs M2 uniqueness
        ├─ rememberSeen()             store fingerprints for this user
        ▼
Save TestForm.payloadJson
        │
        ▼
attachFormAudio()                  lib/generation/audio-fill.ts
        │  TTS per listen-choose clip, per dialogue line, and speaking prompts
        │  Accents: US / UK / Australia × male / female
        ▼
Create exam session (check-in)
```

Difficulty (`easier` / `standard` / `harder`) only changes CEFR bands and Module 2 mix. It does not change the task list.

---

## Uniqueness rules

### Inside one sitting (what the student actually takes)

| Rule | Intentional? |
| --- | --- |
| Four Complete the Words passages on the stored form are all different (Module 1 twice + both Module 2 routes). | Yes — required. |
| Module 1 daily-life titles, listen-and-choose scripts, and spoken-set titles must not appear in **Module 2 lower** or **Module 2 upper**. | Yes — required. Validated in `lib/generation/validate.ts`. |
| **Module 2 lower and Module 2 upper may share leftovers.** | **Yes, on purpose.** Both routes are generated so routing can choose after Module 1. The student takes only one Module 2. Sharing unused leftovers keeps the bank from emptying. |
| Ten Build a Sentence items on one paper are distinct exchanges when the pool is large enough. | Yes. |
| One email and one discussion per paper. | Yes. |

The student never sits both Module 2 routes in the same attempt, so leftover overlap between those two unused-or-alternate papers is not a repeated exam item.

### Across new tests for the same student

Fingerprints are stored per user in `data/seen-items.json` (gitignored). Keys are short normalized hashes of passage text, titles, scripts, sentence exchanges, email scenarios, discussion prompts, and speaking scenarios (`lib/generation/history.ts`).

When a new test is assembled, pickers **prefer unused extras, then unused seeds**, and **newest grown-bank items first**.

**Last-resort reuse:** if the unused pool is empty (no LLM key, or the student has exhausted the bank), the assembler fills from the full seed list so the paper still validates. That is the only time a student can see a previous item again. The markdown and the code treat that as fallback, not as a feature.

### What is *not* treated as a repeat

- **Retake / Redo** of the same form (same questions by design).
- The **unused** Module 2 route sitting in the stored JSON (the student did not take it).
- The same *topic family* (for example two campus-library items) with different wording.

---

## How each question type is built

| Task | Count on a standard paper | How the stimulus is made | How the questions are made |
| --- | ---: | --- | --- |
| **Complete the Words** | 4 passages (2 in M1, 1 per M2 route), 10 gaps each | Handmade CTW passages plus LLM passages (`70–100` words, ≥3 sentences, first sentence intact). `buildCompleteTheWords` cuts the second half of later words until there are 10 gaps. Harder CEFR keeps a smaller prefix. | The “question” is typing the missing letters. No MCQ. |
| **Read in Daily Life** | M1: texts with 2+2+3+3 questions. M2: 2+3. | Handmade daily texts plus LLM emails/notices/schedules (`15–150` words). | 2–3 four-option MCQs. Correct option must paraphrase, not quote. |
| **Read an Academic Passage** | 1 set, M1 only, 5 questions | Handmade academic passages plus one new LLM passage (`~200` words). | Mix of factual / vocab / inference plus **insert-text** (required) and sometimes **select-the-sentence**. Insert uses four black squares. |
| **Listen and Choose a Response** | 16 in M1, 5 in each M2 route | Spoken campus line (`8–30` words). The stem is **audio only**, never printed. LLM writes extra scripts. | Four written replies. Accent/gender rotate (`ACCENT_GENDER_PAIRS`). |
| **Listen to a Conversation** | 4 in M1, 2 per M2 route | Two-speaker campus dialogue (`35–100` words). Handmade + LLM. | 2 MCQs. Each speaker gets an accent/gender. Line-level audio. |
| **Listen to an Announcement** | 2 in M1, 1 per M2 route | One announcer (`40–85` words). | 2 MCQs. |
| **Listen to an Academic Talk** | 1 in M1, 1 per M2 route | Professor-only talk (`175–250` words). Played **slower** (`rate ≈ 0.86`). | 4 MCQs (main idea, fact, inference, purpose). |
| **Build a Sentence** | 10 | Short A/B exchange. Handmade + LLM. Tokens must match the answer words. | Student clicks chips into order. Not a typed cloze. |
| **Write an Email** | 1 | Small handmade pool, then **LLM rewrite** of scenario / audience / goal / sample answer when a key is set. | Open response. Scored later, not generated as MCQ. |
| **Academic Discussion** | 1 | Handmade course thread, then **LLM rewrite** of professor + two students + prompt. | Open response. |
| **Listen and Repeat** | 7 sentences, one scenario | Handmade or LLM scenario with 7 sentences that get longer. | Student records. Timers 8/8/10/10/10/12/12. Each sentence gets a rotating accent. |
| **Take an Interview** | 4 questions | Handmade or LLM scenario + interviewer name. | Fact → reaction → opinion → policy. 45 seconds each. |

LLM batches (when a key is present) currently request about: 4 CTW, 6 daily, 1 academic, 10 listen-and-choose, 2 talks, 4 conversations, 2 announcements, 10 sentences, 1 repeat set, 1 interview. Any item that fails checks is dropped; the rest are kept. Email and discussion are a separate enrich call.

Checks live in `lib/generation/item-checks.ts`: word counts, paragraph shape, 10 CTW gaps, 4 unique options, paraphrase (correct option must not quote a long span of the stimulus), insert-text present, spoken line counts, sentence token/answer match.

---

## Accents (yes, they are embedded)

The system is built for **three English accent families × two genders**:

| Accent code | TTS language | Typical use |
| --- | --- | --- |
| `us` | `en-US` (also accepts Canadian voices) | North American |
| `uk` | `en-GB` (also Irish voices) | British |
| `au` | `en-AU` (also New Zealand voices) | Australian |

Defined in `lib/accents.ts` as `ACCENT_GENDER_PAIRS`.

**Where they appear**

- **Listen and Choose:** each item rotates through the six accent/gender pairs.
- **Conversations / announcements / talks:** each speaker is assigned US/UK/AU by gender and a salt so a dialogue is mixed, not one accent only.
- **Listen and Repeat:** the seven sentences rotate through the same pairs.
- **Browser TTS** maps accent → language. **ElevenLabs / OpenAI** can use per-accent, per-gender voice IDs from `.env`.
- **During the exam** the student only sees **Volume** (plus **Test volume**). Accent pickers stay on review / settings so the sitting stays exam-like.

Audio is still TTS, not studio recordings. Academic talks play slower than campus dialogue.

---

## After the paper exists

1. `attachFormAudio` synthesizes files under the form id (listen-choose, each dialogue line, speaking prompts).
2. The exam UI plays listening audio **once**. Questions for conversations / announcements / talks appear after the clip.
3. Scoring is separate (`lib/score-session.ts`): MCQ keys, sentence match, email/discussion LLM or heuristics, speaking word-error rate / length. Bands are **estimates**, not official ETS scores.

---

## Files to read if you change generation

| File | Role |
| --- | --- |
| `lib/generation/index.ts` | Orchestrates assemble → LLM create → enrich → validate → remember |
| `lib/generation/llm-create.ts` | Parallel JSON batches for almost every task type |
| `lib/generation/llm-enrich.ts` | Email + discussion rewrite |
| `lib/generation/item-checks.ts` | Reject bad LLM seeds |
| `lib/generation/bank-reading.ts` | CTW / daily / academic pickers |
| `lib/generation/bank-listening.ts` | Choose + spoken pickers + accent assignment |
| `lib/generation/bank-writing.ts` | Sentences, email pool, discussion pool |
| `lib/generation/bank-speaking.ts` | Repeat + interview pickers |
| `lib/generation/ctw.ts` | Gap-cutting algorithm |
| `lib/generation/vocab-pack.ts` | Retrieved subjects, campus contexts, writing rules |
| `lib/generation/grown-bank.ts` | `data/item-bank.json` fingerprints and caps |
| `lib/generation/history.ts` | Per-user seen store |
| `lib/generation/validate.ts` | Paper-level counts and M1/M2 uniqueness |
| `lib/generation/audio-fill.ts` | TTS jobs |
| `lib/sessions.ts` | Persist form, then start the sitting |
