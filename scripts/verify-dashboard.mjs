import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './lib/switch.mjs';
// Reuse the browser tooling already installed in this workspace.
const require = createRequire(import.meta.url);
const { chromium } = require('/home/greyw0rks/atlas/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/home/greyw0rks/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const unauthorized = await page.request.get('http://127.0.0.1:3018/api/state');
if (unauthorized.status() !== 401) throw new Error('Dashboard state must require a local session.');
await page.goto('http://127.0.0.1:3018');
await page.getByText('● Live · Switch', { exact: true }).waitFor({ timeout: 20000 });
await page.getByRole('heading', { name: 'A fix you can trace.' }).waitFor();
const rejected = await page.request.post('http://127.0.0.1:3018/api/decision', { data: { decision: 'APPROVE', sha: 'a'.repeat(40) } });
if (rejected.status() !== 403) throw new Error('A decision without origin and CSRF verification must be refused.');
const rejectedRetry = await page.request.post('http://127.0.0.1:3018/api/retry', { data: { role: 'engineer' } });
if (rejectedRetry.status() !== 403) throw new Error('Retry without origin and CSRF verification must be refused.');
const state = await (await page.request.get('http://127.0.0.1:3018/api/state')).json();
if (state.review?.review_ready) {
  await page.locator('#sha').filter({ hasText: state.review.commit_sha }).waitFor();
  if (!state.diff?.includes('src/balance.ts') || !await page.locator('#diff-panel').isVisible()) throw new Error('Reviewed commit must show its actual source diff.');
  if (!await page.getByRole('button', { name: 'Approve this commit', exact: true }).isVisible()) throw new Error('Reviewed commit decision is unavailable.');
}
if (state.publication) {
  await page.locator('#publication-panel').waitFor({ state: 'visible' });
  if (await page.locator('#publication-link').getAttribute('href') !== state.publication.url) throw new Error('Dashboard publication link differs from the recorded PR.');
}
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await page.screenshot({ path: resolve(root, '.runtime/evidence/dashboard-desktop.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: resolve(root, '.runtime/evidence/dashboard-mobile.png'), fullPage: true });
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile dashboard overflows the viewport.');
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ dashboard: 'passed', desktop_mobile: true, unauthorized_reads_refused: true,
  csrf_decisions_and_retries_refused: true, review_ready: state.review?.review_ready === true,
  reviewed_sha: state.review?.commit_sha, publication_url: state.publication?.url, approval_posted: false }));
await browser.close();
