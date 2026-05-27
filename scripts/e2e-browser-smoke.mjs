#!/usr/bin/env node
/* global clearTimeout, console, process, setTimeout */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = Number(process.env.E2E_PORT ?? 5174);
const baseUrl = `http://127.0.0.1:${port}`;

function waitForServer(processHandle) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for Vite dev server')), 30_000);

    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes(`Local:`) || text.includes(`ready in`)) {
        clearTimeout(timeout);
        resolve();
      }
    };

    processHandle.stdout.on('data', onData);
    processHandle.stderr.on('data', onData);
    processHandle.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite dev server exited before startup, code=${code}`));
    });
  });
}

async function run() {
  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    env: {
      ...process.env,
      VITE_E2E_BROWSER: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('new-conversation-button').click();
    await page.getByTestId('chat-input').fill('搜索测试相关的文档');
    await page.getByTestId('send-message-button').click();

    await page.getByTestId('chat-message-user').getByText('搜索测试相关的文档', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByTestId('chat-message-assistant').getByText('E2E mock response for: 搜索测试相关的文档', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByTestId('chat-status').getByText('已完成：mock', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });

    console.log('E2E browser smoke passed');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
