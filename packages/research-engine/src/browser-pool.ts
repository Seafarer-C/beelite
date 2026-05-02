import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;
let mutexChain: Promise<void> = Promise.resolve();

export function withBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = mutexChain;
  let done!: () => void;
  mutexChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  return prev.then(fn).finally(done);
}

export async function getSharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"]
    });
  }
  return browserPromise;
}

/** 释放 Playwright Chromium；Electron 应用退出前应调用 */
export async function closeResearchBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  mutexChain = Promise.resolve();
  await b?.close().catch(() => {});
}
