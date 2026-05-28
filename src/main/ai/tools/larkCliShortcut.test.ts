import { describe, expect, it } from 'vitest';
import { buildLarkShortcutFlagArgs, normalizeLarkShortcutArgs } from './larkCliShortcut';
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

  it('recovers shortcut args when the model places JSON in reason', () => {
    const normalized = normalizeLarkShortcutArgs(
      {},
      'im_chat_messages_list',
      '查看群消息。最终调用：{"capability":"im_chat_messages_list","args":{"chat-id":"oc_3de1e37bfc274d931e01c46a8202dc36","page-size":20},"reason":"查看指定群聊最近2小时消息。"}'
    );

    expect(normalized).toEqual({
      args: {
        'chat-id': 'oc_3de1e37bfc274d931e01c46a8202dc36',
        'page-size': 20,
      },
      recoveredFromReason: true,
    });
    expect(buildLarkShortcutFlagArgs(normalized.args, ['chat-id', 'page-size'])).toEqual([
      '--chat-id',
      'oc_3de1e37bfc274d931e01c46a8202dc36',
      '--page-size',
      '20',
    ]);
  });

  it('recovers escaped args JSON from verbose reasoning text', () => {
    const normalized = normalizeLarkShortcutArgs(
      {},
      'im_chat_messages_list',
      '不要重复。让我确保 JSON 格式完美：{ \\"capability\\": \\"im_chat_messages_list\\", \\"args\\": { \\"chat-id\\": \\"oc_xxx\\", \\"page-size\\": 20 }, \\"reason\\": \\"查看指定群聊最近2小时消息\\" }'
    );

    expect(normalized).toEqual({
      args: {
        'chat-id': 'oc_xxx',
        'page-size': 20,
      },
      recoveredFromReason: true,
    });
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

  it('registers file and base capabilities with conservative risk levels', () => {
    expect(getLarkCapability('drive_upload')?.risk).toBe('write');
    expect(getLarkCapability('drive_download')?.risk).toBe('write');
    expect(getLarkCapability('base_record_list')?.risk).toBe('read');
    expect(getLarkCapability('base_record_upsert')?.risk).toBe('write');
  });

  it('builds Base query flags and rejects unrelated file paths', () => {
    const baseQuery = getLarkCapability('base_data_query');
    expect(
      buildLarkShortcutFlagArgs(
        {
          'base-token': 'bascn_xxx',
          dsl: '{"table":"tbl_xxx"}',
        },
        baseQuery?.allowedFlags ?? []
      )
    ).toEqual(['--base-token', 'bascn_xxx', '--dsl', '{"table":"tbl_xxx"}']);
    expect(() => buildLarkShortcutFlagArgs({ file: '/tmp/a.csv' }, baseQuery?.allowedFlags ?? [])).toThrow(
      'capability does not allow flag --file'
    );
  });
});
