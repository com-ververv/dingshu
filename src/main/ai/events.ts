export type ChatToolEvent =
  | {
      requestId: string;
      type: 'tool-call-start';
      toolCallId: string;
      toolName: string;
      inputPreview: string;
    }
  | {
      requestId: string;
      type: 'tool-call-result';
      toolCallId: string;
      toolName: string;
      status: 'completed' | 'failed' | 'cancelled';
      outputPreview?: string;
      errorMessage?: string;
      elapsedMs: number;
    };

export type ChatToolEventSink = (event: ChatToolEvent) => void;

export function previewJson(value: unknown, maxLength = 2_000): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...<truncated>` : text;
}
