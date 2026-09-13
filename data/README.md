# Local data (not updated by `git pull`)

This folder stays on the machine that runs the mock. Git tracks only empty `audio/` and `recordings/` placeholders so a clone has the folders.

| Path | What it is |
| --- | --- |
| `toefl.db` | Users, papers, answers, scores |
| `app-settings.json` | Gemini model order |
| `item-bank.json` | Extra original items saved after LLM generation |
| `seen-items.json` | Per-student fingerprints so new tests skip old items |
| `prep-jobs.json` | In-progress and finished “prepare a test” jobs |
| `audio/` | Generated listening / speaking prompt files |
| `recordings/` | Student speaking takes |

**Move once** (USB, AirDrop, or `scp`) when you first set up the Mac Mini. After that, `git pull origin main --rebase` updates code only and leaves this folder alone.

Do not commit these files. The GitHub remote is public.
