import { describe, expect, it } from 'vitest';
import { buildChatResult, buildContactResult, buildDocumentResult } from './objectSearch';

describe('lark object search normalization', () => {
  it('normalizes contact results into stable mention references', () => {
    expect(
      buildContactResult({
        open_id: 'ou_xxx',
        localized_name: '张三',
        enterprise_email: 'zhangsan@example.com',
      })
    ).toEqual({
      id: 'ou_xxx',
      reference: '@[联系人:张三](open_id=ou_xxx)',
      subtitle: 'zhangsan@example.com',
      title: '张三',
      type: 'contact',
    });
  });

  it('normalizes chat list results into chat_id references', () => {
    expect(
      buildChatResult({
        chat_id: 'oc_xxx',
        chat_mode: 'group',
        name: '研发群',
      })
    ).toEqual({
      id: 'oc_xxx',
      reference: '@[群:研发群](chat_id=oc_xxx)',
      subtitle: 'group',
      title: '研发群',
      type: 'chat',
    });
  });

  it('normalizes drive search result_meta documents', () => {
    expect(
      buildDocumentResult({
        entity_type: 'WIKI',
        result_meta: {
          doc_types: 'DOCX',
          token: 'doc_token_xxx',
          url: 'https://example.feishu.cn/wiki/doc_token_xxx',
        },
        title_highlighted: '软件<h>测试</h>：工作规划',
      })
    ).toEqual({
      id: 'doc_token_xxx',
      reference: '@[文档:软件测试：工作规划](url=https://example.feishu.cn/wiki/doc_token_xxx)',
      subtitle: 'DOCX',
      title: '软件测试：工作规划',
      type: 'document',
      url: 'https://example.feishu.cn/wiki/doc_token_xxx',
    });
  });
});
