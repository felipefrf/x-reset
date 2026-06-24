import fs from "fs";
import path from "path";

export interface StateFile {
  deletedIds: string[];
  deleted: number;
  errors: number;
  lastRun: string | null;
}

export function loadState(stateFile: string): StateFile {
  try {
    const raw = fs.readFileSync(stateFile, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      deletedIds: Array.isArray(parsed.deletedIds)
        ? parsed.deletedIds
        : Array.isArray(parsed.processed)
          ? parsed.processed
          : [],
      deleted: typeof parsed.deleted === "number" ? parsed.deleted : 0,
      errors: typeof parsed.errors === "number" ? parsed.errors : 0,
      lastRun: typeof parsed.lastRun === "string" ? parsed.lastRun : null,
    };
  } catch {
    return { deletedIds: [], deleted: 0, errors: 0, lastRun: null };
  }
}

export function saveState(stateFile: string, state: StateFile): void {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
}
