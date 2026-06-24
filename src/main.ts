import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG, Config } from "./config";
import { parseArchive, filterTweets } from "./archive";
import { loadState, saveState } from "./state";
import { Deleter } from "./deleter";

function loadConfig(): Config {
  const configPath = path.resolve("./x-reset.json");

  let userConfig: Partial<Config> = {};
  try {
    if (fs.existsSync(configPath)) {
      userConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch {
    console.warn("Could not parse x-reset.json, using defaults.");
  }

  return { ...DEFAULT_CONFIG, ...userConfig };
}

async function main() {
  const config = loadConfig();

  if (!fs.existsSync(config.archiveDir)) {
    console.error(`Archive directory not found: ${config.archiveDir}`);
    console.error("Extract your Twitter archive to ./archive/ first.");
    process.exit(1);
  }

  console.log(`\nParsing archive: ${config.archiveDir}`);
  let allTweets = parseArchive(config.archiveDir, config.username);
  console.log(`Found ${allTweets.length} total entries in archive.`);

  if (config.minAgeDays > 0) {
    allTweets = filterTweets(allTweets, config.minAgeDays);
    console.log(
      `${allTweets.length} tweets after age filter (>= ${config.minAgeDays} days old).`,
    );
  }

  if (!config.deleteRetweets) {
    const before = allTweets.length;
    allTweets = allTweets.filter((t) => !t.isRetweet);
    console.log(`Filtered out ${before - allTweets.length} retweets.`);
  }

  if (!config.deleteReplies) {
    const before = allTweets.length;
    allTweets = allTweets.filter((t) => !t.isReply);
    console.log(`Filtered out ${before - allTweets.length} replies.`);
  }

  if (!config.deleteTweets) {
    const before = allTweets.length;
    allTweets = allTweets.filter((t) => t.isRetweet || t.isReply);
    console.log(`Filtered to ${allTweets.length} retweets + replies only.`);
  }

  const state = loadState(config.stateFile);
  const pending = allTweets.filter((t) => !state.deletedIds.includes(t.id));

  console.log(
    `State: ${state.deleted} deleted so far, ${state.errors} errors, ${pending.length} pending (${state.deletedIds.length} already processed).\n`,
  );

  if (pending.length === 0) {
    console.log("No pending tweets to delete.");
    return;
  }

  const pendingIds = pending.map((t) => t.id);

  console.log(
    `Starting deletion of up to ${config.maxDeletions > 0 ? config.maxDeletions : "unlimited"} tweets.`,
  );
  console.log(
    `Delays: ${config.minDelayMs / 1000}-${config.maxDelayMs / 1000}s between deletions,`,
  );
  console.log(
    `        ${config.cooldownMs / 1000}s cooldown every ${config.cooldownAfter} deletions.\n`,
  );

  const deleter = new Deleter(config);

  let gracefulShutdown = false;
  const sigintHandler = async () => {
    gracefulShutdown = true;
    console.log("\n\nInterrupted. Saving state and closing...");
    await deleter.close();
    saveState(config.stateFile, state);
    console.log(`Progress saved to ${config.stateFile}`);
    process.exit(0);
  };

  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigintHandler);

  try {
    await deleter.init();

    const result = await deleter.runQueue(pendingIds, (deletedId: string) => {
      state.deleted++;
      state.deletedIds.push(deletedId);
      state.lastRun = new Date().toISOString();
      try {
        saveState(config.stateFile, state);
      } catch {
        // non-fatal: state will retry on next save
      }
    });

    state.errors += result.errors;
    state.lastRun = new Date().toISOString();
    saveState(config.stateFile, state);

    console.log(`\nDone. Deleted: ${result.deleted}, Errors: ${result.errors}`);
    console.log(
      `Total so far: ${state.deleted} deleted, ${state.errors} errors.`,
    );
    console.log(`State saved to ${config.stateFile}`);

    const remaining = allTweets.filter(
      (t) => !state.deletedIds.includes(t.id),
    );
    if (remaining.length > 0) {
      console.log(
        `Run again to process ${remaining.length} remaining tweets.`,
      );
    }
  } finally {
    if (!gracefulShutdown) {
      await deleter.close();
    }
    process.off("SIGINT", sigintHandler);
    process.off("SIGTERM", sigintHandler);
  }
}

main().catch(async (err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  try {
    const config = loadConfig();
    const state = loadState(config.stateFile);
    saveState(config.stateFile, state);
    console.log(`State saved to ${config.stateFile} before exit.`);
  } catch {}
  process.exit(1);
});
