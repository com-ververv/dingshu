import { describe, expect, it } from 'vitest';
import { buildLarkShortcutFlagArgs, normalizeLarkShortcutArgs, validateLarkShortcutArgs } from './larkCliShortcut';
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

  it('infers chat message list args from a natural-language reason', () => {
    const normalized = normalizeLarkShortcutArgs(
      {},
      'im_chat_messages_list',
      '用户要求查看指定群聊（oc_3de1e37bfc274d931e01c46a8202dc36）最近 2 小时的消息，需要读取该群的消息列表并按时间筛选。'
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

  it('infers contact search query from a natural-language reason', () => {
    const normalized = normalizeLarkShortcutArgs({}, 'contact_search_user', '查询用户「艺彪」的邮箱信息');

    expect(normalized).toEqual({
      args: {
        query: '艺彪',
      },
      recoveredFromReason: true,
    });
    expect(buildLarkShortcutFlagArgs(normalized.args, ['query'])).toEqual(['--query', '艺彪']);
  });

  it('infers contact search query from unquoted email lookup text', () => {
    const normalized = normalizeLarkShortcutArgs({}, 'contact_search_user', '查询 艺彪 的邮箱');

    expect(normalized).toEqual({
      args: {
        query: '艺彪',
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

  it('marks shortcuts that do not expose --format as formatless', () => {
    expect(getLarkCapability('calendar_rsvp')?.supportsFormat).toBe(false);
    expect(getLarkCapability('mail_reply')?.supportsFormat).toBe(false);
    expect(getLarkCapability('mail_forward')?.supportsFormat).toBe(false);
  });

  it('validates required filters before invoking lark-cli', () => {
    const vcSearch = getLarkCapability('vc_search');
    const okrCycleList = getLarkCapability('okr_cycle_list');

    expect(validateLarkShortcutArgs(vcSearch!, {})).toBe(
      '调用 vc_search 至少需要提供一个参数：--query、--start、--end、--organizer-ids、--participant-ids、--room-ids。'
    );
    expect(validateLarkShortcutArgs(vcSearch!, { query: '周会' })).toBeUndefined();
    expect(validateLarkShortcutArgs(okrCycleList!, {})).toBe('调用 okr_cycle_list 缺少必填参数 --user-id。');
    expect(validateLarkShortcutArgs(okrCycleList!, { 'user-id': 'ou_xxx' })).toBeUndefined();
  });

  it('validates calendar suggestion attendee id prefixes', () => {
    const calendarSuggestion = getLarkCapability('calendar_suggestion');

    expect(validateLarkShortcutArgs(calendarSuggestion!, { 'attendee-ids': 'g8af7fg8' })).toBe(
      '参数 --attendee-ids 的 ID 格式不正确：g8af7fg8。应使用 ou_ 开头的用户 open_id，或 oc_ 开头的群 ID。'
    );
    expect(validateLarkShortcutArgs(calendarSuggestion!, { 'attendee-ids': 'ou_xxx,oc_xxx' })).toBeUndefined();
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
