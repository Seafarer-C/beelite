export function readErrorCode(value: unknown): string {
  if (!value || typeof value !== "object" || !("code" in value)) return "";
  return typeof (value as { code?: unknown }).code === "string"
    ? (value as { code: string }).code
    : "";
}

export function describeFetchSearchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = readErrorCode(error.cause);
  if (code === "ENOTFOUND") return `DNS lookup failed (${code})`;
  if (code === "ETIMEDOUT") return `Request timed out (${code})`;
  if (code === "ECONNRESET") return `Connection reset (${code})`;
  return error.message;
}
