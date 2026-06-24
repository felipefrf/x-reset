# x-reset

Bulk-delete your old tweets, retweets, and replies from X/Twitter using your official [Twitter archive](https://x.com/settings/download_your_data).

Uses Playwright to drive a real Chrome browser — deletes tweets one by one with configurable delays and cooldowns. Resumable: progress is saved after every deletion.

---

## Quick start

### 1. Download your Twitter/X archive

- Go to [x.com/settings/download_your_data](https://x.com/settings/download_your_data)
- Request your archive (may take 24–48h for X to prepare it)
- Download the ZIP and extract everything into the `archive/` folder

### 2. Install & configure

```bash
npm install
```

Edit `x-reset.json` — change `username` to your own handle (without `@`).

### 3. Run

```bash
npm start
```

A Chrome window opens. Log in to X manually (one-time). The tool then deletes tweets automatically. Press `Ctrl+C` to stop — progress is saved.

---

## Configuration: `x-reset.json`

### What to delete

| Key | Default | Description |
|---|---|---|
| `username` | `"felipefrf"` | Your X handle without `@` |
| `deleteTweets` | `true` | Delete your regular tweets |
| `deleteRetweets` | `true` | Delete your retweets |
| `deleteReplies` | `true` | Delete your replies |
| `minAgeDays` | `30` | Only delete tweets older than N days. `0` = all ages |

### Speed & timing

| Key | Default | Description |
|---|---|---|
| `minDelayMs` | `2000` | Minimum wait between deletions (ms) |
| `maxDelayMs` | `2000` | Maximum wait between deletions (ms) |
| `cooldownAfter` | `25` | Deletions before a cooldown break |
| `cooldownMs` | `120000` | Cooldown duration in ms (120s = 2 min) |
| `maxDeletions` | `0` | Stop after N deletions. `0` = unlimited |
| `headed` | `true` | Show browser window (`false` = headless) |

> **Proven safe profile** (used to delete 1,429 tweets with zero rate-limit issues):
> Delays 2s, 2-minute cooldown every 25 deletions.
>
> **Aggressive (test at your own risk):**
> ```json
> "minDelayMs": 0,
> "maxDelayMs": 0,
> "cooldownAfter": 25,
> "cooldownMs": 60000
> ```

---

## How it works

1. Parses `archive/data/tweets.js` (and `tweets-part*.js`) to extract all tweet IDs
2. Filters by age, type (tweet/RT/reply) per your config
3. Skips IDs already processed (stored in `state.json`)
4. Opens each tweet URL, clicks `...` > `Delete` > confirm
5. Saves progress after each successful deletion

### Rate limiting & safety

- If X shows a rate-limit page, the tool backs off for 2–8 minutes and continues
- Rate-limited tweets are **not** marked as deleted — they retry on next run
- Deleted/missing tweets are detected and skipped automatically
- Session expiry triggers a re-login prompt (or graceful stop if unattended)
- Ctrl+C saves progress and closes cleanly

### State & resuming

- `state.json` — tracks which IDs have been deleted. Safe to delete to start fresh
- `browser-profile/` — persistent browser profile (cookies, localStorage). Delete if login gets stuck
- Run `npm start` anytime — it picks up where it left off

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Can't log in (Google/security blocks) | The tool uses a persistent Chrome profile. If X flags it, delete `browser-profile/` and try again |
| "Session expired" during run | If you're at the computer, just log in again in the browser window. If unattended, the tool stops gracefully and saves progress |
| "Tweet article not found" | The tweet may already be deleted or X didn't render the page in time. These are skipped and counted as deleted |
| Rate limited mid-run | The tool detects the rate-limit page and backs off automatically for several minutes |
| `npm start` crashes on login | Delete `browser-profile/` and `state.json`, then run `npm start` again |

## License

MIT
