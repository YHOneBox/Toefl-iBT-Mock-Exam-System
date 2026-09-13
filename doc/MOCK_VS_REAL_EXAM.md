# How close is this mock to the real enhanced TOEFL iBT?

**Date:** 13 September 2026  
**Scope:** This repo vs the enhanced TOEFL iBT (2026) described in `doc/TOEFL_iBT_Comprehensive_Guide.pdf` and `content/constraints/`.  
**Not used as content:** official ETS items and the copyrighted Official Guide PDF.

## Product goal

Match the **doing-the-exam sitting**: screens, clocks, play-once audio, module lock, record-once speaking, question numbers, notes, volume, and Help.

**Out of scope on purpose**

- ID check, photo, NDA, ETS account
- Locked browser / proctor
- Official ETS IRT scores or a predicted real score

This is a local practice system. Bands are estimates.

---

## Overall verdict

| Layer | Closeness | Notes |
| --- | --- | --- |
| Exam shape (order, tasks, counts, clocks) | **High (~85%)** | Standard full test is 50 / 47 / 12 / 11 with official-style splits. |
| Live sitting (on-screen rules) | **High (~80%)** | Header, Hide Time, notes, volume, play-once, questions after audio, auto-record, confirm submit. Not an ETS client. |
| Item quality and variety | **Medium–high (~65–75%)** | Original campus/academic items; new tests generate and save more; Module 1/2 CTW texts are unique. |
| Audio (accents) | **Medium (~55–70%)** | US / UK / Australia × male / female. Line-level TTS; academic talks play slower. Still not studio. |
| Scoring | **Low–medium (~35–45%)** | 1–6 display only. Not official IRT or human raters. |
| Test-day security | **Out of scope** | No ID check. Local sign-in only. |

**Headline:** Use this to practice **how the 2026 exam feels to take**. Do not treat the band as your real TOEFL score.

---

## Live sitting: what now matches

These are in the exam path (not the library).

| Real sitting | This mock |
| --- | --- |
| Reading → Listening → Writing → Speaking, no break | Same |
| Untimed directions; clock starts when you continue | Same |
| Header: section, question n of N, clock | Same |
| Hide Time / Show Time | Same |
| Help, Volume, Notes | Same (volume only in the exam, plus a **Test volume** beep/voice; accent pickers stay on review/settings) |
| Reading: back inside a module; review list; submit locks the module | Same, with confirm before submit |
| Listening: play once; stem/choices after audio; no back | Same; Next stays off until the audio finishes |
| Speaking: hear once, then record once | Same; recording starts after the prompt; Next stays off until recorded |
| Confirm before finishing | Same |
| After the test is submitted, answers cannot be changed | Same (server lock + no return to `/exam/...`) |
| Desktop layout | Same |
| ID / photo / lockdown | **Not implemented** (by design) |

Practice tools stay **outside** the sitting: main page library, sectioned review, retake/redo, compare, difficulty picker. The admin account only manages users.

---

## What the real exam requires (reference)

| Section | Time | Items | Format |
| --- | ---: | ---: | --- |
| Reading | ~30 min | ~50 | Multistage adaptive (M1 ~35, M2 ~15) |
| Listening | ~29 min | ~47 | Multistage adaptive (M1 ~32, M2 ~15) |
| Writing | 23 min | 12 | Linear (10 sentences + email + discussion) |
| Speaking | ~8 min | 11 | Linear (7 repeats + 4 interview) |

Order: **Reading → Listening → Writing → Speaking**. Accents: North America, UK, Australia. Official scores: **1–6** (half points) with CEFR labels.

---

## What we do well (and why)

### 1. Exam skeleton

A **standard** new test:

- **Reading M1:** 2× Complete the Words (10 gaps) + daily life (2+2+3+3) + 1 academic (5) = **35**
- **Reading M2:** 1× Complete the Words + daily life (2+3) = **15**
- **Listening M1:** 16 choose + 4 conversations (×2) + 2 announcements (×2) + 1 talk (×4) = **32**
- **Listening M2:** 5 + 4 + 2 + 4 = **15**
- **Writing:** 10 + email + discussion = **12**
- **Speaking:** 7 + 4 = **11**

Validated in `lib/generation/validate.ts`. Order in `lib/flow.ts`.

### 2. Clocks

| Part | Official (approx.) | Mock |
| --- | --- | --- |
| Reading M1 | 18–21 min | **20 min** (includes module review) |
| Reading M2 | 9 min | **9 min** |
| Listening M1 | 18 min | **18 min** |
| Listening M2 | 7 / 11 min | **7 / 11 min** |
| Build a Sentence / email / discussion | 6 / 7 / 10 | **Same** |
| Listen and Repeat | 8, 8, 10, 10, 10, 12, 12 s | **Same** |
| Interview | 45 s | **45 s** |

One table in `lib/timing.ts`. Time-out advances the section.

### 3. Enhanced task types (not old iBT)

Complete the Words; Read in Daily Life; short academic passage; Listen and Choose (stem not printed); conversation / announcement / talk; Build a Sentence; email; academic discussion; Listen and Repeat; Take an Interview.

### 4. Adaptive *shape*

Both Module 2 routes are generated. Module 1 accuracy ≥ 60% → upper. Upper Listening gets the longer clock. Not ETS IRT.

### 5. Listening / speaking rules

Play once. Questions after audio. Accents US/UK/AU and both genders on **new** forms. Writing spellcheck off. Notes not scored. Finished tests are locked.

### 6. Allowed topics

Introductory academic families plus campus life. No official ETS wording.

---

## What we cannot do (or only partly)

Scoring, bank size, and studio audio are the remaining gaps. ID check is **not** a gap we plan to close.

### A. Scoring is not official

ETS uses IRT and trained / official speech rating. We use percent correct, a homemade 1–6 table, sentence match, email/discussion LLM or heuristics, and speaking WER / length.

**Improve:** keep the “not official” label; require Whisper for speaking; show raw counts next to bands.

### B. Routing is a 60% cut

Not an ability estimate. Items are not IRT-weighted.

**Improve:** CEFR-weighted Module 1.

### C. Growing original bank

Handmade seed bank is still small. On **Start new test**, if a Gemini/OpenAI key is set, the system retrieves subjects and campus contexts from `content/constraints/subjects-vocab.md`, generates extra CTW / daily / academic / listen-choose / talks / conversations / sentences / speaking seeds, rejects items that fail word counts, gap counts, or paraphrase checks, and appends accepted items to `data/item-bank.json`. Later papers prefer those saved items **and skip fingerprints this student already sat**. The stored paper, including both Module 2 routes, cannot repeat a passage, listen-and-choose script, dialogue line, or speaking sentence. Full pipeline: [QUESTION_GENERATION.md](QUESTION_GENERATION.md).

| Bank | Starting size | Per full form |
| --- | ---: | ---: |
| CTW passages | 6 + grown | 4 unique |
| Daily-life texts | 8 + grown | 8 unique across both Module 2 routes |
| Academic passages | few + grown | 1 (M1 only) |
| Listen-and-choose | ~27 + grown | 16+5+5 |
| Conversations / announcements / talks | 8 / 4 / 3 + grown | 8 / 4 / 3 |
| Build a Sentence | 12 + grown | 10 |
| Emails / discussions | 3 / 2, LLM rewrite | 1 / 1 |
| Repeat / interview sets | 2 / 2 + grown | 1 / 1 |

Official Guide wording is still not used.

### D. Audio is TTS

Browser speech or ElevenLabs / OpenAI. Not studio. Conversations, announcements, and talks now synthesize **one file per script line**. Academic talks play slower than campus dialogue.

### E. Speaking scores do not hear delivery

Repeats = word-error rate on a transcript. Interview = LLM on text or word-count. No pronunciation / fluency.

**Improve:** required transcription; fluency features; relevance check on interview.

### F. Academic insert-text and select-the-sentence

Academic passages use black squares in the text for insert-text, and clickable sentences for select-the-sentence, including review highlighting.

### G. Complete the Words is closer to spec

New generated passages must be 70–100 words with 10 gaps. Assembled forms allow 68–110 so older seed texts still validate.

### H. Reading Module 2 has no academic passage

Count is 15, mix is CTW + daily life only.

### I. Writing samples / constructed scores

Heuristic or LLM. Bank emails now have real sample letters; review replaces old broken templates.

### J. Test-day security — out of scope

No ID, photo, NDA, or locked browser. That is intentional.

### K. Do not copy official forms

Write more original items. Use official ETS practice separately if you buy it.

---

## Section scorecard

### Reading

| Real | Mock |
| --- | --- |
| ~50 items, ~30 min | Yes (35+15; 20+9) |
| CTW / daily / academic | Yes; academic M1 only |
| Back + review + lock | Yes |
| Insert-text / select-sentence UI | Yes (squares and click-a-sentence) |
| Official score | No |

### Listening

| Real | Mock |
| --- | --- |
| ~47 items, ~29 min | Yes (32+15; 18+7/11) |
| Play once; questions after audio | Yes |
| US / UK / AU × gender | Yes on new forms (TTS) |
| Official score | No |

### Writing

| Real | Mock |
| --- | --- |
| 12 items, 23 min | Yes |
| Sentence chips; unused words on review | Yes |
| Email / discussion 0–5 | Partial |
| Official score | No |

### Speaking

| Real | Mock |
| --- | --- |
| 7 + 4, official timers | Yes |
| Hear then record once | Yes |
| Delivery / intelligibility | Transcript / length only |
| Official score | No |

---

## What to improve next (sitting already in place)

1. Keep generating so the saved bank is several times larger than the handmade seed.
2. Required Whisper (or equivalent) before a speaking band.
3. CEFR-weighted Module 1 routing.
4. Studio or multi-voice dialogue files if you want audio closer than TTS.

---

## Bottom line

The **sitting** is close enough to practice the 2026 exam: order, clocks, play-once listening, module lock, record-once speaking, Help / Volume / Notes / Hide Time.

We **do not** do ID check, and we **cannot** give an official score. Treat the report as practice feedback only.
