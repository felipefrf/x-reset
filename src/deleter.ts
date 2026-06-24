import fs from "fs";
import path from "path";
import { chromium, BrowserContext, Page } from "playwright";
import type { Config } from "./config";

type DeleteResult = "deleted" | "already_gone" | "rate_limited" | "error";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const RATE_LIMIT_TEXTS = [
  "rate limit",
  "too many requests",
  "something went wrong",
  "try again later",
  "you are unable to",
  "temporarily restricted",
];

export class Deleter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;
  private consecutive: number = 0;
  private consecutiveErrors: number = 0;

  constructor(config: Config) {
    this.config = config;
  }

  private log(msg: string) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${msg}`);
  }

  async init(): Promise<void> {
    const userDataDir = path.resolve("./browser-profile");
    this.log(`Using persistent profile: ${userDataDir}`);

    const args = [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=IPH_DemoMode",
    ];

    try {
      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: !this.config.headed,
        args,
        viewport: { width: 1280, height: 900 },
      });

      this.context.on("page", (page) => {
        this.page = page;
      });

      this.page = this.context.pages()[0] ?? (await this.context.newPage());

      await this.page.goto("https://x.com/home", {
        waitUntil: "domcontentloaded",
      });

      if (!(await this.isLoggedIn())) {
        await this.waitForLogin();
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        await this.page.goto("https://x.com/home", {
          waitUntil: "domcontentloaded",
        });
        await sleep(3000);
        if (await this.isLoggedIn()) break;
        if (attempt < 2) {
          this.log(`Login verification attempt ${attempt + 1} failed, retrying...`);
        }
      }

      if (!(await this.isLoggedIn())) {
        throw new Error("Login verification failed after redirect.");
      }

      this.log("Ready. Session confirmed.");
    } catch (err) {
      await this.cleanup();
      throw err;
    }
  }

  private async waitForLogin(): Promise<void> {
    if (!this.page) return;
    this.log("Not logged in. Please log in manually in the browser window.");
    this.log("Waiting up to 5 minutes... Press Ctrl+C to abort.");

    try {
      await this.page.waitForFunction(
        () => {
          const url = window.location.href;
          const onTwitter = url.includes("x.com") && !url.includes("login");
          const hasProfileLink = !!document.querySelector(
            'a[data-testid="AppTabBar_Profile_Link"]',
          );
          return onTwitter && hasProfileLink;
        },
        { timeout: 300_000 },
      );
      this.log("Login detected.");
    } catch {
      this.log("Login timeout. Exiting.");
      throw new Error("Login timeout");
    }
  }

  private async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const url = this.page.url();
      if (url.includes("x.com/login") || url.includes("x.com/i/flow/login")) {
        return false;
      }
      const profileLink = await this.page.$(
        'a[data-testid="AppTabBar_Profile_Link"]',
      );
      return !!profileLink;
    } catch {
      return false;
    }
  }

  private async isRateLimited(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const bodyText = (
        await this.page.locator("body").innerText()
      ).toLowerCase();
      return RATE_LIMIT_TEXTS.some((phrase) => bodyText.includes(phrase));
    } catch {
      return false;
    }
  }

  private async isOnLoginPage(): Promise<boolean> {
    if (!this.page) return false;
    const url = this.page.url();
    return (
      url.includes("x.com/login") || url.includes("x.com/i/flow/login")
    );
  }

  private async deleteTweet(tweetId: string): Promise<DeleteResult> {
    if (!this.page) return "error";

    const url = `https://x.com/${this.config.username}/status/${tweetId}`;

    try {
      await this.page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await sleep(3000);

      if (await this.isOnLoginPage()) {
        this.log("  Redirected to login — session expired.");
        return "error";
      }

      if (await this.isRateLimited()) {
        this.log("  Rate limit detected on page.");
        return "rate_limited";
      }

      const deletedTexts = [
        'text="Hmm...this page doesn\'t exist"',
        'text="This Tweet was deleted"',
        'text="This Post was deleted"',
        'text="This Tweet is unavailable"',
      ];
      let alreadyGone = false;
      for (const sel of deletedTexts) {
        if (await this.page.$(sel).catch(() => null)) {
          alreadyGone = true;
          break;
        }
      }
      if (alreadyGone) return "already_gone";

      const tweetSelector = `article:has(a[href*="/status/${tweetId}"])`;
      const tweetArticle = this.page.locator(tweetSelector).first();

      if (!(await tweetArticle.isVisible({ timeout: 5000 }).catch(() => false))) {
        await sleep(3000);
        if (!(await tweetArticle.isVisible({ timeout: 5000 }).catch(() => false))) {
          this.log("  Tweet article not found after retry.");
          return "already_gone";
        }
      }

      const caretBtn = tweetArticle.locator('[data-testid="caret"]');
      await caretBtn.scrollIntoViewIfNeeded();
      await sleep(300);
      await caretBtn.click();
      await this.page.waitForTimeout(800);

      if (await this.isRateLimited()) {
        this.log("  Rate limit detected after opening menu.");
        return "rate_limited";
      }

      const deleteMenuItem = this.page.getByRole("menuitem", {
        name: /delete/i,
      });

      if (
        !(await deleteMenuItem.isVisible({ timeout: 3000 }).catch(() => false))
      ) {
        if (await this.isOnLoginPage()) {
          this.log("  Redirected to login — session expired.");
          return "error";
        }
        return "already_gone";
      }

      await deleteMenuItem.click();
      await this.page.waitForTimeout(800);

      const confirmBtn = this.page.getByRole("button", {
        name: /^delete$/i,
      });
      const altConfirm = this.page.locator(
        'button[data-testid="confirmationSheetConfirm"]',
      );

      const confirmElement = (
        await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
      )
        ? confirmBtn
        : (await altConfirm.isVisible({ timeout: 3000 }).catch(() => false))
          ? altConfirm
          : null;

      if (!confirmElement) {
        this.log("  Confirm button not found.");
        return "error";
      }

      await confirmElement.click();
      await sleep(1000);
      return "deleted";
    } catch (err: any) {
      if (err.message?.includes("timeout")) {
        return "rate_limited";
      }
      this.log(`  Error: ${err.message}`);
      return "error";
    }
  }

  private async rateLimitCooldown(): Promise<void> {
    const baseMinutes = Math.min(this.consecutiveErrors + 1, 5);
    const minutes = randBetween(baseMinutes * 2, baseMinutes * 4);
    this.log(`RATE LIMITED: backing off for ${minutes} minutes...`);
    await sleep(minutes * 60_000);
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    await sleep(2000);

    if (await this.isLoggedIn()) return true;

    this.log("Session expired. Please log in again.");
    try {
      await this.waitForLogin();
    } catch {
      this.log("Could not re-login. Run 'npm start' again after logging in.");
      return false;
    }

    await this.page.goto("https://x.com/home", {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    if (!(await this.isLoggedIn())) {
      this.log("Login verification failed after re-login.");
      return false;
    }
    this.log("Re-login confirmed.");
    return true;
  }

  async runQueue(
    ids: string[],
    onDeleted?: (id: string) => void,
  ): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      if (i >= this.config.maxDeletions && this.config.maxDeletions > 0) {
        this.log(`Max deletions (${this.config.maxDeletions}) reached.`);
        break;
      }

      const id = ids[i];

      if (!/^\d{10,}$/.test(id)) {
        this.log(`[${i + 1}/${ids.length}] Skipping invalid ID: ${id}`);
        continue;
      }

      if (!(await this.isLoggedIn())) {
        const reLogged = await this.ensureLoggedIn();
        if (!reLogged) {
          this.log("Stopping — login required. Progress has been saved.");
          break;
        }
      }

      const url = `https://x.com/${this.config.username}/status/${id}`;
      const progress = `${i + 1}/${Math.min(ids.length, this.config.maxDeletions || ids.length)}`;
      this.log(`[${progress}] Deleting ${url}`);

      const result = await this.deleteTweet(id);

      switch (result) {
        case "deleted":
          deleted++;
          this.consecutive++;
          this.consecutiveErrors = 0;
          onDeleted?.(id);
          break;
        case "already_gone":
          deleted++;
          this.consecutive++;
          this.consecutiveErrors = 0;
          onDeleted?.(id);
          break;
        case "rate_limited":
          this.consecutiveErrors++;
          errors++;
          await this.rateLimitCooldown();
          this.consecutive = 0;
          break;
        case "error":
          this.consecutiveErrors++;
          errors++;
          if (await this.isOnLoginPage()) {
            const reLogged = await this.ensureLoggedIn();
            if (!reLogged) {
              this.log("Stopping — login required. Progress has been saved.");
              return { deleted, errors };
            }
          }
          break;
      }

      if (this.consecutive >= this.config.cooldownAfter) {
        const cooldownSecs = Math.round(this.config.cooldownMs / 1000);
        this.log(
          `Processed ${this.consecutive} in a row — ${cooldownSecs}s cooldown...`,
        );
        await sleep(this.config.cooldownMs);
        this.consecutive = 0;
      }

      if (i < ids.length - 1) {
        const delay = randBetween(
          this.config.minDelayMs,
          this.config.maxDelayMs,
        );
        if (delay > 0) {
          this.log(`  Waiting ${Math.round(delay / 1000)}s before next...`);
          await sleep(delay);
        }
      }
    }

    return { deleted, errors };
  }

  async close(): Promise<void> {
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
