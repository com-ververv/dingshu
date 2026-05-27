import { spawn } from 'node:child_process';
import { app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const LARK_CLI_PACKAGE_PATH = path.join('node_modules', '@larksuite', 'cli');

export type LarkCliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type LarkCliErrorType =
  | 'auth'
  | 'permission'
  | 'missing_argument'
  | 'missing_scope'
  | 'network'
  | 'not_found'
  | 'timeout'
  | 'unknown';

export type LarkCliOptions = {
  abortSignal?: AbortSignal;
  executable?: string;
  isolatedProfile?: boolean;
  stdin?: string;
  timeoutMs: number;
};

export function getLarkCliBin(): string {
  if (process.env.LARK_CLI_BIN) {
    return process.env.LARK_CLI_BIN;
  }

  const executableName = process.platform === 'win32' ? 'lark-cli.exe' : 'lark-cli';
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'lark-cli', 'bin', executableName)
    : path.join(app.getAppPath(), LARK_CLI_PACKAGE_PATH, 'bin', executableName);

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  return 'lark-cli';
}

export function getLarkCliPackageRoot(): string | null {
  const executable = getLarkCliBin();
  const binDir = path.dirname(executable);
  const packageRoot = path.dirname(binDir);
  return fs.existsSync(path.join(packageRoot, 'package.json')) ? packageRoot : null;
}

export function verifyBundledLarkCli(): { ok: boolean; executable: string; packageRoot?: string; sha256?: string; error?: string } {
  const executable = getLarkCliBin();
  if (!fs.existsSync(executable)) {
    return {
      ok: false,
      executable,
      error: 'lark-cli executable not found',
    };
  }

  const packageRoot = getLarkCliPackageRoot();
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
  return {
    ok: true,
    executable,
    packageRoot: packageRoot ?? undefined,
    sha256,
  };
}

export function classifyLarkCliError(value: string): LarkCliErrorType {
  const text = value.toLowerCase();
  if (text.includes('timed out') || text.includes('timeout')) {
    return 'timeout';
  }
  if (text.includes('missing required scope') || text.includes('missing_scope')) {
    return 'missing_scope';
  }
  if (text.includes('permission denied') || text.includes('forbidden') || text.includes('no permission')) {
    return 'permission';
  }
  if (text.includes('unauthorized') || text.includes('access token') || text.includes('auth login') || text.includes('invalid token')) {
    return 'auth';
  }
  if (text.includes('required flag') || text.includes('missing required') || text.includes('unknown flag')) {
    return 'missing_argument';
  }
  if (text.includes('not found') || text.includes('404')) {
    return 'not_found';
  }
  if (text.includes('econnreset') || text.includes('enotfound') || text.includes('network') || text.includes('socket')) {
    return 'network';
  }
  return 'unknown';
}

export function runLarkCli(args: string[], options: LarkCliOptions): Promise<LarkCliResult> {
  const executable = options.executable ?? getLarkCliBin();
  const larkHome = path.join(app.getPath('userData'), 'lark-cli-profile');
  const larkWorkdir = path.join(app.getPath('userData'), 'lark-cli-workdir');
  fs.mkdirSync(larkWorkdir, { recursive: true });
  const shouldUseIsolatedProfile = options.isolatedProfile === true || fs.existsSync(path.join(larkHome, '.lark-cli'));
  if (shouldUseIsolatedProfile) {
    fs.mkdirSync(larkHome, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: larkWorkdir,
      env: {
        ...process.env,
        ...(shouldUseIsolatedProfile
          ? {
              HOME: larkHome,
              LARK_CLI_HOME: larkHome,
              USERPROFILE: larkHome,
            }
          : {}),
        NO_COLOR: '1',
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
