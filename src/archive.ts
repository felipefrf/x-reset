import fs from "fs";
import path from "path";

interface TweetEntry {
  id: string;
  createdAt: string;
  isRetweet: boolean;
  isReply: boolean;
  text: string;
}

interface RawFallbackEntry {
  id: string;
  isRetweet: boolean;
  isReply: boolean;
}

function extractIdsFromFile(filePath: string): RawFallbackEntry[] {
  const raw = fs.readFileSync(filePath, "utf-8");

  const idStrMap = new Map<string, { isRetweet: boolean; isReply: boolean }>();

  const idPattern = /"id_str"\s*:\s*"(?<id>\d+)"/g;
  let match;
  while ((match = idPattern.exec(raw)) !== null) {
    const id = match.groups!.id;
    if (!idStrMap.has(id)) {
      idStrMap.set(id, { isRetweet: false, isReply: false });
    }
  }

  const retweetPattern = /"retweeted"\s*:\s*true/g;
  while ((match = retweetPattern.exec(raw)) !== null) {
    const before = raw.slice(0, match.index);
    const tweetMatch = before.match(/"id_str"\s*:\s*"(?<id>\d+)"[^}]*\}/g);
    if (tweetMatch) {
      const last = tweetMatch[tweetMatch.length - 1];
      const idMatch = last.match(/"id_str"\s*:\s*"(?<id>\d+)"/);
      if (idMatch?.groups?.id && idStrMap.has(idMatch.groups.id)) {
        idStrMap.get(idMatch.groups.id)!.isRetweet = true;
      }
    }
  }

  const replyPattern = /"in_reply_to_status_id_str"\s*:\s*"\d+"/g;
  while ((match = replyPattern.exec(raw)) !== null) {
    const before = raw.slice(0, match.index);
    const tweetMatch = before.match(/"id_str"\s*:\s*"(?<id>\d+)"[^}]*\}/g);
    if (tweetMatch) {
      const last = tweetMatch[tweetMatch.length - 1];
      const idMatch = last.match(/"id_str"\s*:\s*"(?<id>\d+)"/);
      if (idMatch?.groups?.id && idStrMap.has(idMatch.groups.id)) {
        idStrMap.get(idMatch.groups.id)!.isReply = true;
      }
    }
  }

  const results: RawFallbackEntry[] = [];
  for (const [id, meta] of idStrMap) {
    results.push({ id, ...meta });
  }
  return results;
}

function parseDate(twitterDate: string): Date {
  if (!twitterDate) return new Date(0);

  const isoMatch = twitterDate.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (isoMatch) return new Date(isoMatch[1] + "Z");

  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const match = twitterDate.match(
    /[A-Za-z]{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+\+0000\s+(\d{4})/,
  );
  if (!match) return new Date(0);

  const [, month, day, time, year] = match;
  const monthNum = months[month];
  if (!monthNum) return new Date(0);
  return new Date(`${year}-${monthNum}-${day.padStart(2, "0")}T${time}Z`);
}

export function parseArchive(
  archiveDir: string,
  _username: string,
): TweetEntry[] {
  const dataDir = path.join(archiveDir, "data");
  const tweets: TweetEntry[] = [];

  let dirEntries: string[] = [];
  try {
    dirEntries = fs.readdirSync(dataDir);
  } catch {
    return [];
  }

  const partFiles = dirEntries.filter(
    (f) => f === "tweets.js" || f.startsWith("tweets-part"),
  );

  for (const partFile of partFiles) {
    const filePath = path.join(dataDir, partFile);
    const raw = fs.readFileSync(filePath, "utf-8");

    const jsonStart = raw.indexOf("[");
    if (jsonStart === -1) continue;

    let jsonStr = raw.slice(jsonStart).trimEnd().replace(/;$/, "");
    try {
      const entries = JSON.parse(jsonStr);
      for (const entry of entries) {
        if (!entry) continue;
        const tweet = entry.tweet ?? entry;
        const id = tweet.id_str ?? tweet.id ?? "";
        const text = tweet.full_text ?? tweet.text ?? "";
        const createdAt = tweet.created_at ?? tweet.createdAt ?? "";

        const isRetweet =
          text.startsWith("RT @") ||
          !!tweet.retweeted_status_id_str ||
          !!tweet.retweeted;
        const isReply = !!tweet.in_reply_to_status_id_str;

        tweets.push({
          id: String(id),
          createdAt,
          isRetweet,
          isReply,
          text,
        });
      }
    } catch {
      const fallbackEntries = extractIdsFromFile(filePath);
      for (const fe of fallbackEntries) {
        tweets.push({
          id: fe.id,
          createdAt: "",
          isRetweet: fe.isRetweet,
          isReply: fe.isReply,
          text: "",
        });
      }
    }
  }

  return tweets;
}

export function filterTweets(tweets: TweetEntry[], minAgeDays: number) {
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;

  return tweets.filter((t) => {
    if (t.createdAt) {
      const date = parseDate(t.createdAt);
      if (date.getTime() > cutoff) return false;
    }
    return true;
  });
}
