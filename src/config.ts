import path from "path";

export interface Config {
  username: string;

  archiveDir: string;
  stateFile: string;
  sessionFile: string;

  minDelayMs: number;
  maxDelayMs: number;
  cooldownAfter: number;
  cooldownMs: number;
  maxDeletions: number;

  headed: boolean;

  deleteRetweets: boolean;
  deleteReplies: boolean;
  deleteTweets: boolean;

  minAgeDays: number;
}

export const DEFAULT_CONFIG: Config = {
  username: "felipefrf",

  archiveDir: path.resolve("./archive"),
  stateFile: path.resolve("./state.json"),
  sessionFile: path.resolve("./session.json"),

  minDelayMs: 5_000,
  maxDelayMs: 15_000,
  cooldownAfter: 15,
  cooldownMs: 300_000,
  maxDeletions: 100,

  headed: true,

  deleteRetweets: false,
  deleteReplies: false,
  deleteTweets: true,

  minAgeDays: 30,
};
