# TOEFL iBT Mock (local)

Local practice for the **enhanced TOEFL iBT (2026)**. The live sitting follows the real exam: Reading → Listening → Writing → Speaking, no scheduled break, adaptive Reading/Listening, official-style clocks, play-once audio, and record-once speaking.

It does **not** include ID check, photo, or a locked ETS browser. Scores are **estimates**, not official ETS results.

How close we are, and what we still cannot do: [doc/MOCK_VS_REAL_EXAM.md](doc/MOCK_VS_REAL_EXAM.md). How every item is generated: [doc/QUESTION_GENERATION.md](doc/QUESTION_GENERATION.md).

## Setup

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env` if you need API keys. The database is SQLite at `data/toefl.db`.

To run this on a Mac Mini and open it from another device over VPN, see [doc/HOSTING_MAC_MINI.md](doc/HOSTING_MAC_MINI.md). Clone gets code; copy `data/` and `.env` once; later updates are `git pull origin main --rebase`.

The first account you create should be **admin** (username `admin`). That account only manages users: create accounts, change any password (including admin), and delete a student and their tests. Admin cannot take a mock test. Each student has a separate library.

## Taking a test

1. Sign in and start a new test (easier / standard / harder). Standard matches the real exam mix.
2. The exam chrome is section name, question number, Help, Volume (with **Test volume**), Notes, clock, and Hide Time. The blue header stays on screen; long article/question screens scroll each pane separately.
3. Reading: you may go back inside a module, then review and submit. After submit, that module is locked.
4. Listening: each recording plays once. Choices appear when the audio ends. You cannot go back.
5. Writing: 10 Build a Sentence items (6 min), email (7 min), discussion (10 min). Browser spelling is off.
6. Speaking: play the prompt, then recording starts. One take. Repeat timers are 8/8/10/10/10/12/12 seconds; interview is 45 seconds.
7. After you finish, you cannot reopen the exam to change answers. Use **Retake** or **Redo** for a new attempt.

## After the test

- Review **one section at a time** (Reading / Listening / Writing / Speaking).
- Writing review shows unused sentence chips and a model email.
- Speaking review shows 0–5 item scores (repeats use word-error rate).
- Retake the full paper or redo selected parts. Sign in as **admin** to manage accounts.

## Optional API keys

A full paper can be generated from the built-in bank with no keys.

- `GEMINI_API_KEY` — new original items on **Start new test**, plus scoring for email, discussion, and interview. In the app, **Gemini models** scans the key and sets fallback order.
- `OPENAI_API_KEY` — last-resort LLM, TTS, and Whisper transcription.
- `ELEVENLABS_API_KEY` — optional TTS. You can set a voice per accent and gender in `.env.example`.

Without TTS keys, audio uses the browser synthesizer (US / UK / Australia, male and female). Without Whisper, speaking scores use a saved transcript or a length check.

Accent voices can be assigned on review or settings. During the exam, only **Volume** is shown.

## Notes

- Desktop layout, like the real test.
- Official ETS items and the Official Guide PDF are not used as content.
- Allowed references: `doc/TOEFL_iBT_Comprehensive_Guide.pdf` and `doc/TOEFL iBT Academic Subjects and Vocabulary Topics.pdf`.
- With an LLM key, each new test writes extra original items (checked, then saved to `data/item-bank.json`) so later papers reuse fewer stock passages.
- A new test prefers items this student has not seen. Module 1 and Module 2 do not share daily texts, listen-and-choose scripts, or spoken sets. The unused Module 2 route may share leftovers with the other Module 2 route on purpose (only one is administered). Last-resort reuse happens only if the unused pool is empty. Accents are US / UK / Australia × male / female.
