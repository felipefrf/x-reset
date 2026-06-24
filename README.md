# x-reset

Bulk-delete your old tweets and replies from X/Twitter using your official [Twitter archive](https://x.com/settings/download_your_data).

The tool opens a real Chrome browser (via Playwright) and deletes tweets one by one, with random delays between actions to reduce the chance of getting rate-limited or flagged.

---

## Prerequisites

You need **Node.js** installed on your computer (version 18 or newer).

| OS | How to install |
|---|---|
| **Windows** | Download from [nodejs.org](https://nodejs.org) — get the **LTS** version. Run the installer. |
| **macOS** | Download from [nodejs.org](https://nodejs.org) — or if you have Homebrew: `brew install node` |
| **Linux** | Use your package manager. Example: `sudo apt install nodejs npm` (Ubuntu/Debian). |

To verify it worked, open a terminal and run:

```bash
node --version   # should show v18.x or higher
npm --version    # should show 9.x or higher
```

> **Don't know how to open a terminal?**
>
> Windows: Press `Win + R`, type `cmd`, press Enter.
> macOS: Press `Cmd + Space`, type `Terminal`, press Enter.
> Linux: Usually `Ctrl + Alt + T`.

---

## Quick start (3 steps)

### 1. Download this project

Click the green **Code** button at the top of this page → **Download ZIP**. Extract the ZIP to any folder on your computer.

### 2. Get your Twitter/X archive

- Go to [x.com/settings/download_your_data](https://x.com/settings/download_your_data)
- Request your archive (it may take 24–48 hours for X to prepare it)
- Once ready, download the ZIP and extract the **entire contents** into the `archive/` folder inside the project

> The `archive/` folder should contain a `data/` subfolder with `tweets.js` (or `tweets-part*.js` files) inside.

### 3. Configure and run

Open the project folder in a terminal and run:

```bash
npm install        # installs dependencies (only needed once)
npm start          # starts the tool
```

**Edit `x-reset.json` first** — at minimum, change `username` to your own X handle (without the `@`).

A Chrome window will open. Log in to your X account, and the tool starts deleting. Press `Ctrl + C` to stop at any time — your progress is saved and you can resume later.

---

## Configuration: `x-reset.json`

This file controls what gets deleted and how fast. Open it with any text editor (Notepad, VS Code, etc.).

### Required

| Key | Example | What it does |
|---|---|---|
| `username` | `"yourhandle"` | Your X/Twitter username **without the @**. This is the only setting you **must** change. |

### What to delete

| Key | Default | What it does | When to change it |
|---|---|---|---|
| `deleteTweets` | `true` | Delete your **regular tweets** (original posts). | Set to `false` if you only want to clean retweets/replies. |
| `deleteRetweets` | `false` | Delete your **retweets**. | Set to `true` if you also want to clean retweets. |
| `deleteReplies` | `false` | Delete your **replies** to other people. | Set to `true` if you also want to clean replies. |
| `minAgeDays` | `30` | Only delete tweets **older than** this many days. | Increase to be more conservative (e.g. `365` for 1 year). Set to `0` to delete everything regardless of age. |

> **Example:** To delete everything (tweets, retweets, replies, any age):
> ```json
> "deleteTweets": true,
> "deleteRetweets": true,
> "deleteReplies": true,
> "minAgeDays": 0
> ```

### Speed & safety

These control the pace of deletions. Higher values are **safer** (less likely to trigger rate limits), but slower.

| Key | Default | What it does | Impact |
|---|---|---|---|
| `minDelayMs` | `5000` | Minimum pause between each deletion. | 5000 = 5 seconds. Lower = faster but riskier. Don't go below 3000. |
| `maxDelayMs` | `15000` | Maximum pause between each deletion. | The tool picks a random delay between min and max each time. 15000 = 15 seconds. |
| `cooldownAfter` | `15` | How many deletions before taking a longer break. | After 15 deletions, a cooldown kicks in. Lower = more breaks = safer. |
| `cooldownMs` | `300000` | Cooldown duration in milliseconds. | 300000 = 5 minutes. This is the longer rest between deletion batches. |
| `maxDeletions` | `100` | Stop after this many deletions per run. `0` = no limit. | Useful to limit damage. Run the tool again to continue where you left off. |
| `headed` | `true` | Show the browser window. | `true` = you can see what's happening. `false` = runs hidden in the background. |

> **Safe profile** (slow, unlikely to get limited):
> ```json
> "minDelayMs": 10000,
> "maxDelayMs": 20000,
> "cooldownAfter": 10,
> "cooldownMs": 600000
> ```

> **Aggressive profile** (fast, higher risk):
> ```json
> "minDelayMs": 4000,
> "maxDelayMs": 8000,
> "cooldownAfter": 25,
> "cooldownMs": 120000
> ```

### Advanced

| Key | Default | What it does |
|---|---|---|
| `archiveDir` | `"./archive"` | Where your extracted Twitter archive is located. |
| `stateFile` | `"./state.json"` | Where progress is saved. Don't change unless you need to. |
| `sessionFile` | `"./session.json"` | Where the browser session is stored. Don't change unless you need to. |

---

## Resuming & resetting

- **Progress is saved** to `state.json` after every deletion. If you stop the tool (or it crashes), just run `npm start` again — it picks up where it left off.
- **To start fresh**, delete `state.json` and `session.json`. Optionally delete `browser-profile/` to clear the cached login.
- Already-deleted tweets (that don't exist anymore) are skipped automatically and counted as successful.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "archive directory not found" | Make sure you extracted the Twitter ZIP into `archive/` and it has a `data/` folder inside. |
| Browser opens but nothing happens | Check that you're logged in. If the tool says "Not logged in", log in manually in the browser window and wait — it detects your login and continues. |
| "Rate limit" or "Too many requests" | The tool will back off automatically for a few minutes and resume. Lower your `minDelayMs`/`maxDelayMs` and reduce `cooldownAfter` in `x-reset.json`. |
| "Session expired" | Your login cookie expired. Delete `browser-profile/` and `session.json`, then run `npm start` again. |
| Stuck or frozen | Press `Ctrl + C` to stop, then run `npm start` again. Progress is saved. |
| `npm` not recognized | Node.js is not installed or not in your PATH. Reinstall from [nodejs.org](https://nodejs.org). |

---

## License

MIT
