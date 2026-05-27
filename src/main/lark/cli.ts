import { spawn } from 'node:child_process';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LARK_CLI_BIN = process.env.LARK_CLI_BIN ?? 'lark-cli';

export type LarkCliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type LarkCliOptions = {
  abortSignal?: AbortSignal;
  executable?: string;
  stdin?: string;
  timeoutMs: number;
};

export function getLarkCliBin(): string {
  return DEFAULT_LARK_CLI_BIN;
}

export function runLarkCli(args: string[], options: LarkCliOptions): Promise<LarkCliResult> {
  const executable = options.executable ?? DEFAULT_LARK_CLI_BIN;
  const larkHome = path.join(app.getPath('userData'), 'lark-cli-profile');
  const larkWorkdir = path.join(app.getPath('userData'), 'lark-cli-workdir');
  fs.mkdirSync(larkHome, { recursive: true });
  fs.mkdirSync(larkWorkdir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: larkWorkdir,
      env: {
        ...process.env,
        HOME: larkHome,
        LARK_CLI_HOME: larkHome,
        NO_COLOR: '1',
        USERPROFILE: larkHome,
      },
    });

    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      options.abortSignal?.removeEventListener('abort', handleAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const handleAbort = () => {
      child.kill('SIGTERM');
      settle(() => {
        resolve({ exitCode: null, stdout, stderr: stderr || 'cancelled' });
      });
    };

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      settle(() => {
        reject(new Error(`lark-cli timed out after ${options.timeoutMs}ms: ${executable} ${args.join(' ')}`));
      });
    }, options.timeoutMs);

    if (options.abortSignal?.aborted) {
      handleAbort();
      return;
    }
    options.abortSignal?.addEventListener('abort', handleAbort, { once: true });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      settle(() => reject(error));
    });
    child.on('close', (exitCode) => {
      settle(() => resolve({ exitCode, stdout, stderr }));
    });
  });
}
