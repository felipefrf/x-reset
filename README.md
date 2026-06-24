# x-reset

Delete your old tweets and replies from X/Twitter using your [Twitter archive](https://x.com/settings/download_your_data).

It uses Playwright to automate deletion through a real browser, with configurable delays and cooldowns to avoid rate limits.

## Setup

```bash
npm install
```

## Usage

1. Request and download your [Twitter/X archive](https://x.com/settings/download_your_data).
2. Extract it to `./archive/`.
3. Configure `x-reset.json` (see below).
4. Run:

```bash
npm start
```

A browser window opens. Log in to your X account. The tool then deletes tweets automatically.

Press `Ctrl+C` to stop — progress is saved to `state.json` and resumes on next run.

## Configuration (`x-reset.json`)

| Key | Default | Description |
|---|---|---|
| `username` | `"felipefrf"` | Your X username |
| `archiveDir` | `"./archive"` | Path to extracted archive |
| `minAgeDays` | `30` | Skip tweets newer than this |
| `deleteTweets` | `true` | Delete regular tweets |
| `deleteRetweets` | `false` | Delete retweets |
| `deleteReplies` | `false` | Delete replies |
| `minDelayMs` | `5000` | Min delay between deletions |
| `maxDelayMs` | `15000` | Max delay between deletions |
| `cooldownAfter` | `15` | Deletions before cooldown |
| `cooldownMs` | `300000` | Cooldown duration (ms) |
| `maxDeletions` | `100` | Max per run (0 = unlimited) |
| `headed` | `true` | Show browser UI |

## License

MIT
