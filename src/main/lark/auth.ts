import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { runLarkCli } from './cli';

const LARK_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

export type LarkAuthStatus = {
  configured: boolean;
  profilePath: string;
};

type LarkAuthStartOutput = {
  data?: {
    device_code?: string;
    user_code?: string;
    verification_url?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
  };
  device_code?: string;
  user_code?: string;
  verification_url?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
};

export function getLarkProfilePath(): string {
  return path.join(app.getPath('userData'), 'lark-cli-profile');
}

export function getLarkAuthStatus(): LarkAuthStatus {
  return {
    configured: fs.existsSync(getLarkProfilePath()),
    profilePath: getLarkProfilePath(),
  };
}

function parseAuthStartOutput(stdout: string): {
  deviceCode?: string;
  userCode?: string;
  verificationUrl?: string;
} {
  const parsed = JSON.parse(stdout) as LarkAuthStartOutput;
  const data = parsed.data ?? parsed;
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUrl: data.verification_uri_complete ?? data.verification_url ?? data.verification_uri,
  };
}

export async function startLarkUserAuth(domain: string): Promise<{
  deviceCode?: string;
  userCode?: string;
  verificationUrl?: string;
}> {
  const result = await runLarkCli(
    ['auth', 'login', '--domain', domain, '--no-wait', '--json'],
    {
      isolatedProfile: true,
      timeoutMs: 30_000,
    }
  );

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || 'lark-cli auth login failed');
  }

  return parseAuthStartOutput(result.stdout);
}

export async function configureLarkApp(appId: string, appSecret: string): Promise<void> {
  const result = await runLarkCli(['config', 'init', '--brand', 'feishu', '--app-id', appId, '--app-secret-stdin'], {
    isolatedProfile: true,
    stdin: appSecret,
    timeoutMs: 30_000,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || 'lark-cli config init failed');
  }
}

export async function completeLarkUserAuth(deviceCode: string): Promise<void> {
  const result = await runLarkCli(['auth', 'login', '--device-code', deviceCode], {
    isolatedProfile: true,
    timeoutMs: LARK_AUTH_TIMEOUT_MS,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || 'lark-cli auth login failed');
  }
}
