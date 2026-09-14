# How this mock generates questions

This file describes the **item pipeline** for a new enhanced TOEFL iBT paper in this repo. It is not an ETS document. Official ETS items and the copyrighted Official Guide PDF are **not** used as source text.

**Allowed references**

- `doc/TOEFL_iBT_Comprehensive_Guide.pdf` (structure and task types only)
- `doc/TOEFL iBT Academic Subjects and Vocabulary Topics.pdf`
- `content/constraints/exam-blueprint.md`
- `content/constraints/subjects-vocab.md`
- `content/constraints/rubrics.md`

**What “Start new test” means**

- **New test** (`/api/generate`) starts a **prep job** with a progress bar. It writes original items and assembles a paper that contains **no fingerprints this student has already seen**.
- The job keeps generating until the unused pool is large enough, **or** until a hard stop. It does **not** fall back to repeating old items. If there is no API key and the unused bank is empty, preparation fails instead of reusing.
- **Stops:** you can press **Stop** on the dashboard. A job also stops if it runs longer than **12 minutes**, if it goes **4 minutes** without a progress update, or if the same missing item type fails **4** focused LLM retries (max **8** assemble rounds). A stopped or failed job never saves a paper.
- You can **prepare several papers for later**: they queue one at a time (max 5 per request, 8 unused or queued in total). Start any unused paper later with no wait.
- **Retake** and **Redo** reuse an existing form on purpose (same questions, new sitting). That is not a new test.

---

## End-to-end pipeline

```
Student clicks Start when ready  or  Prepare for later
        │
        ▼
POST /api/generate  →  prep job (data/prep-jobs.json)
        │  UI polls GET /api/generate  for stage, detail, log, %
        │  DELETE /api/generate/:jobId  cancels the running job
        ▼
generateFormPayload(difficulty, userId, onProgress, { signal })
        │
        ├─ Load this student's seen fingerprints
        │     data/seen-items.json
        │     always union with every TestForm this user already has
        │
        ├─ Load grown bank
        │     data/item-bank.json  +  handmade seeds in bank-*.ts
        │
        ├─ Assemble from unused handmade + grown-bank items first
        │     no Gemini call if a unique paper can already be built
        │
        ├─ If a slot is missing and an API key is set
        │     createFreshItems()  one focused batch at a time
        │     requests are queued and spaced (Flash ~4 RPM, Lite ~8 RPM)
        │     unused Gemini 2.5 quota is preferred over exhausted 3.x models
        │     max 8 assemble rounds; 4 empty tries per missing kind
        │
        ├─ enrichWithLlm()      at most one paced email + discussion refresh
        ├─ validateForm()       counts, CTW rules, full-form uniqueness
        │                       (audio, passages, stems, both Module 2 routes)
        ▼
Save TestForm.payloadJson
        │
        ▼
attachFormAudio()                  progress per clip (25s TTS timeout)
        │
        ├─ rememberSeen()
        ▼
intent=start  →  create exam session (check-in)
intent=prepare →  leave the form unused until the student starts it
```

Difficulty (`easier` / `standard` / `harder`) only changes CEFR bands and Module 2 mix. It does not change the task list.

---

## Uniqueness rules

The stored paper is unique **as a whole**, including the unused Module 2 route. That route is still synthesized, and leftover overlap used to replay the same audio if routing later chose the other path, or if two spoken sets shared a script under different titles.

A saved paper is rejected if any question stem, item fingerprint, passage, or audio repeats on the paper or matches this student’s seen store. LLM batches drop already-seen stems and stimuli before they enter the bank.

### Inside one stored paper (both Module 2 routes)

| Rule | Required |
| --- | --- |
| Four Complete the Words passages are all different. | Yes |
| Daily-life and academic **texts** (not only titles) are unique across Module 1, Module 2 lower, and Module 2 upper. | Yes |
| Every listen-and-choose **script**, conversation/announcement/talk **line**, listen-and-repeat sentence, and interview prompt is unique. A choose line may not reappear inside a dialogue. | Yes |
| Spoken sets are unique by **full joined script**, not by title. | Yes |
| Build a Sentence exchanges, email scenario, discussion prompt, and speaking scenarios are unique on the paper. Question stems must be unique **across the whole paper**, including both Module 2 routes. The same stem cannot appear in reading and listening. | Yes |
| Two clips that share the same first 96 normalized characters are treated as the same opening and rejected. | Yes |
| Audio fill refuses to synthesize the same script twice. | Yes |

Checks live in `lib/generation/uniqueness.ts` and run from `validateForm()` after assemble, after enrich, and again before TTS.

### Across new tests for the same student

Fingerprints are stored per user in `data/seen-items.json` (gitignored). Keys are the **full normalized text** of passages, scripts, lines, exchanges, and speaking sentences, plus the older 96-character prefix so earlier papers still match (`lib/generation/history.ts`, `lib/generation/content-key.ts`).

`seenForUser` always unions the file with every TestForm that user already has. Pickers then skip any item whose full text or legacy prefix is in that set.

If a slot cannot be filled without reuse, the job **writes more original items** and tries again. It does not fall back to a seen item. Without an LLM key, preparation fails when the unused pool is too small. A failed job never saves a paper.

### What is *not* treated as a repeat

- **Retake / Redo** of the same form (same questions by design).
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

LLM batches run only when the unused bank cannot fill a slot. They are sequential, not parallel, and a global limiter waits between Gemini calls so Flash stays under 5 requests/minute and Lite under about 8. JSON/shape failures retry the same model; they do not walk the whole fallback chain. A 429 cools that model (hours if the daily cap is exhausted) and the next unused model is tried — Gemini 2.5 Flash-Lite / Flash first. Focused retries request only the missing kind. Email and discussion get at most one later enrich call. Easier papers use A2–B1 writing seeds, including B1 discussion prompts (the old bank only had B2 discussions, which made easier generation stall).

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
| `lib/generation/index.ts` | Assembles unused items first; focused sequential LLM only if a slot is missing |
| `lib/generation/jobs.ts` | Background prep jobs and progress |
| `lib/generation/llm-create.ts` | Sequential JSON batches for the missing task type |
| `lib/gemini-limiter.ts` | Global Gemini spacing, per-model RPM gaps, daily-cap cooldown |
| `lib/generation/llm-enrich.ts` | Email + discussion rewrite |
| `lib/generation/item-checks.ts` | Reject bad LLM seeds |
| `lib/generation/bank-reading.ts` | CTW / daily / academic pickers |
| `lib/generation/bank-listening.ts` | Choose + spoken pickers + accent assignment |
| `lib/generation/bank-writing.ts` | Sentences, email pool, discussion pool |
| `lib/generation/bank-speaking.ts` | Repeat + interview pickers |
| `lib/generation/ctw.ts` | Gap-cutting algorithm |
| `lib/generation/vocab-pack.ts` | Retrieved subjects, campus contexts, writing rules |
| `lib/generation/grown-bank.ts` | `data/item-bank.json` fingerprints and caps |
| `lib/generation/content-key.ts` | Full-text keys and legacy fingerprint matching |
| `lib/generation/uniqueness.ts` | Paper-level duplicate audio / text / stem checks |
| `lib/generation/history.ts` | Per-user seen store (file + all stored forms) |
| `lib/generation/validate.ts` | Paper-level counts and uniqueness |
| `lib/generation/audio-fill.ts` | TTS jobs; refuses duplicate scripts |
| `lib/sessions.ts` | Persist form, then start the sitting |
