import { describe, expect, it } from 'vitest';
import { classifyLarkCliError } from './cli';

describe('classifyLarkCliError', () => {
  it('classifies missing scopes', () => {
    expect(classifyLarkCliError('missing required scope(s): minutes:minutes.search:read')).toBe('missing_scope');
  });

  it('classifies auth failures', () => {
    expect(classifyLarkCliError('invalid access token, run lark-cli auth login')).toBe('auth');
  });

  it('classifies permission failures', () => {
    expect(classifyLarkCliError('Permission denied: no permission to access this resource')).toBe('permission');
  });

  it('classifies argument failures', () => {
    expect(classifyLarkCliError('required flag(s) "message-id" not set')).toBe('missing_argument');
  });

  it('falls back to unknown', () => {
    expect(classifyLarkCliError('unexpected cli output')).toBe('unknown');
  });
});
