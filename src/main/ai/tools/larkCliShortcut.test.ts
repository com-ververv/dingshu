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
});
