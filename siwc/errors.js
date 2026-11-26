export class SiwcError extends Error {
  constructor(code, message, { status, requestId, retryable } = {}) {
    super(message);
    this.name = "SiwcError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable ?? (status === 429 || status >= 500 ||
      ["network_error", "timeout", "verification_unavailable", "refresh_not_ready"].includes(code));
  }
}

export function publicError(error) {
  if (!(error instanceof SiwcError)) {
    return { code: "internal_error", message: "SIWC 操作失败，请重试。", retryable: false };
  }
  const { code, message, status, requestId, retryable } = error;
  return { code, message, status, requestId, retryable };
}
