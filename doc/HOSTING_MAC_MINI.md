# Host on a Mac Mini and use it over VPN

The GitHub repo holds **code and allowed reference docs**. Exam data, API keys, audio, and recordings stay on the Mac Mini so `git pull origin main --rebase` can update the system without wiping users or scores.

The GitHub repo is **public**. Do not put `.env` or `data/toefl.db` in git.

## What a clone gives you

After `git clone`, you have the app, Prisma schema, built-in item seeds, and constraint packs. You do **not** automatically get:

- this Windows machine’s SQLite database (accounts and finished tests)
- `.env` API keys
- generated `data/item-bank.json` / `data/seen-items.json`
- files under `data/audio/` and `data/recordings/`

Copy those once. Then only pull code.

## 1. On this PC: save a one-time data bundle

In PowerShell, from the project folder:

```powershell
Compress-Archive -Path "data\toefl.db","data\app-settings.json","data\audio","data\recordings" -DestinationPath "toefl-local-data.zip" -Force
if (Test-Path "data\item-bank.json") { Compress-Archive -Path "data\item-bank.json" -DestinationPath "toefl-local-data.zip" -Update }
if (Test-Path "data\seen-items.json") { Compress-Archive -Path "data\seen-items.json" -DestinationPath "toefl-local-data.zip" -Update }
```

Copy **both** of these to the Mac Mini (USB, AirDrop, or a private folder — not GitHub):

- `toefl-local-data.zip`
- `.env` (your keys; never commit this file)

`toefl-local-data.zip` is gitignored.

## 2. On the Mac Mini: clone and restore data

```bash
git clone https://github.com/YHOneBox/Toefl-iBT-Mock-Exam-System.git
cd Toefl-iBT-Mock-Exam-System
git checkout main

# one-time: keys + exam data from this PC
cp /path/to/.env .env
unzip /path/to/toefl-local-data.zip -d data

npm install
npx prisma generate
npx prisma db push
npm run build
```

`db push` updates the schema if needed and keeps existing rows.

If you skip the zip, the Mac Mini starts empty: create `admin` again, then student accounts.

## 3. Listen on the VPN interface

```bash
npm run host
```

That is `next start -H 0.0.0.0 -p 3000`. It accepts connections from localhost **and** the Mac Mini’s VPN address.

For day-to-day development instead of a production build:

```bash
npm run dev:host
```

If Next.js blocks scripts from the VPN host during `dev:host`, add the origin you type in the browser to `.env`:

```
ALLOWED_ORIGINS=http://100.x.y.z:3000
```

Use your real VPN IP. Restart the server after changing `.env`.

## 4. Open it from another device on the same VPN

1. Connect that device to the **same VPN** as the Mac Mini (Tailscale, WireGuard, and so on).
2. On the Mac Mini, note the VPN IP (`ifconfig` or the VPN app). Tailscale IPs often look like `100.x.x.x`.
3. In the browser: `http://THAT_IP:3000`

Do not port-forward 3000 on your public router. VPN-only is enough for this local mock.

### macOS firewall

System Settings → Network → Firewall. Allow incoming for **Node** if the other device cannot connect.

### Keep it running

In Terminal:

```bash
cd ~/Toefl-iBT-Mock-Exam-System
npm run host
```

Leave that session open, or use `screen` / `tmux`, or add a Login Item that runs the same command.

## 5. Update code later (does not replace exam data)

On the Mac Mini:

```bash
cd ~/Toefl-iBT-Mock-Exam-System
git pull origin main --rebase
npm install
npx prisma generate
npx prisma db push
npm run build
```

Then start again with `npm run host`.

`git pull --rebase` updates tracked files only. `.env`, `data/toefl.db`, the item bank, seen-items, audio, and recordings stay on the Mac Mini.

If rebase stops on a local edit you made on the Mac Mini, finish or stash that edit, then rebase again. Prefer changing the app on this development PC, commit, push, and only pull on the Mini.

## 6. After you change the app on this PC

```bash
git add -A
git status   # confirm .env and data/*.db are not listed
git commit -m "Your message"
git push origin main
```

Then on the Mac Mini: `git pull origin main --rebase` and rebuild.

## Accounts

Passwords live only in `data/toefl.db`. If you copied that file, sign in with the same usernames as on this PC. This guide does not store or print passwords.
