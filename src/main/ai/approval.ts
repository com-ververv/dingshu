export type ApprovalRequest = {
  approvalId: string;
  inputPreview: string;
  riskSummary: string;
  targetPreview?: string;
  toolCallId: string;
  toolName: string;
};

export type ApprovalDecision = {
  approved: boolean;
  reason?: string;
};

type PendingApproval = {
  reject: (error: Error) => void;
  resolve: (decision: ApprovalDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;
const pendingApprovals = new Map<string, PendingApproval>();

export function createApprovalId(toolName: string, toolCallId: string): string {
  return `${toolName}_${toolCallId}`;
}

export function waitForApproval(request: ApprovalRequest, abortSignal?: AbortSignal): Promise<ApprovalDecision> {
  if (pendingApprovals.has(request.approvalId)) {
    return Promise.reject(new Error(`approval already pending: ${request.approvalId}`));
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      pendingApprovals.delete(request.approvalId);
      abortSignal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      resolve({ approved: false, reason: 'cancelled' });
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ approved: false, reason: 'approval timed out' });
    }, APPROVAL_TIMEOUT_MS);

    pendingApprovals.set(request.approvalId, {
      resolve: (decision) => {
        cleanup();
        resolve(decision);
      },
      reject: (error) => {
        cleanup();
        reject(error);
      },
      timeout,
    });

    if (abortSignal?.aborted) {
      handleAbort();
      return;
    }
    abortSignal?.addEventListener('abort', handleAbort, { once: true });
  });
}

export function resolveApproval(approvalId: string, decision: ApprovalDecision): boolean {
  const pending = pendingApprovals.get(approvalId);
  if (!pending) {
    return false;
  }
  pending.resolve(decision);
  return true;
}
