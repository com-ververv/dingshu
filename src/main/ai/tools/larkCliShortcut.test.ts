import { describe, expect, it } from 'vitest';
import { buildLarkShortcutFlagArgs } from './larkCliShortcut';
import { getLarkCapability } from '../../lark/capabilities';

describe('lark_cli_shortcut', () => {
  it('builds allowlisted flag args', () => {
    expect(buildLarkShortcutFlagArgs({ query: '测试', 'page-size': 3 }, ['query', 'page-size'])).toEqual([
      '--query',
      '测试',
      '--page-size',
      '3',
    ]);
  });

  it('keeps boolean true flags and skips false flags', () => {
    expect(buildLarkShortcutFlagArgs({ 'page-all': true, mine: false }, ['page-all', 'mine'])).toEqual(['--page-all']);
  });

  it('rejects flags outside the capability allowlist', () => {
    expect(() => buildLarkShortcutFlagArgs({ output: '/tmp/leak' }, ['query'])).toThrow(
      'capability does not allow flag --output'
    );
  });

  it('marks sheets shortcuts as formatless because lark-cli does not expose --format there', () => {
    expect(getLarkCapability('sheets_info')?.supportsFormat).toBe(false);
    expect(getLarkCapability('calendar_agenda')?.supportsFormat).not.toBe(false);
  });

  it('keeps write capabilities behind explicit allowlists', () => {
    const taskCreate = getLarkCapability('task_create');
    expect(taskCreate?.risk).toBe('write');
    expect(buildLarkShortcutFlagArgs({ summary: '测试任务', 'dry-run': true }, taskCreate?.allowedFlags ?? [])).toEqual([
      '--summary',
      '测试任务',
      '--dry-run',
    ]);
  });

  it('does not allow direct mail send flags in draft/reply/forward capabilities', () => {
    const mailReply = getLarkCapability('mail_reply');
    const mailForward = getLarkCapability('mail_forward');
    expect(mailReply?.allowedFlags).not.toContain('confirm-send');
    expect(mailForward?.allowedFlags).not.toContain('confirm-send');
    expect(() => buildLarkShortcutFlagArgs({ 'confirm-send': true }, mailReply?.allowedFlags ?? [])).toThrow(
      'capability does not allow flag --confirm-send'
    );
  });
});
