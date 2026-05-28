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

    await page.getByText('SiliconFlow API Key 无法读取', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByText('缺少应用凭证', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByTestId('chat-message-assistant').getByText('上次生成已中断，可点击下方按钮重新发送上一条。', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.locator('.message-state').getByText('已停止', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });

    await page.getByRole('button', { name: /Settings/ }).click();
    await page.locator('.settings-panel .needs-attention').getByText('需重新保存', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.locator('.credential-warning').getByText('已保存的 API Key 无法读取，请重新保存。', { exact: false }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByRole('button', { name: 'About' }).click();
    await page.getByText('Pexar Lark Agent 是桌面端飞书 AI 助手', { exact: false }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.locator('.settings-panel .close-button').click();

    await page.evaluate((key) => globalThis.localStorage.setItem(key, 'healthy'), 'e2eSecureStatus');
    await page.reload({ waitUntil: 'domcontentloaded' });

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
    await page.getByTestId('chat-status').getByText('已完成', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByPlaceholder('搜索会话').fill('测试相关');
    await page.locator('.conversation-list .conversation-title').getByText('搜索测试相关的文档', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByPlaceholder('搜索会话').fill('');

    await page.getByTestId('new-conversation-button').click();
    await page.getByTestId('chat-input').fill('审批拒绝：请创建飞书文档');
    await page.getByTestId('send-message-button').click();
    await page.getByTestId('chat-status').getByText('等待确认', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByText('动作：创建飞书云文档', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByText('E2E审批拒绝', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByTestId('chat-message-assistant').last().getByRole('button', { name: '拒绝' }).click();
    await page.getByText('创建操作已被取消，文档未生成。', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByTestId('chat-status').getByText('已完成', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    const latestAssistant = page.getByTestId('chat-message-assistant').last();
    await latestAssistant.locator('.message-state').getByText('已完成', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });

    await page.getByTestId('new-conversation-button').click();
    await page.getByTestId('chat-input').fill('发送飞书消息到研发群：E2E消息');
    await page.getByTestId('send-message-button').click();
    await page.getByTestId('chat-status').getByText('等待确认', { exact: true }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
    await page.getByText('发送飞书消息', { exact: true }).waitFor({
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
