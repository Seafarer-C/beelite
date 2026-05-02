export function stableId(prefix: string, parts: Array<string | number | undefined>): string {
  const input = parts
    .filter((part): part is string | number => part !== undefined)
    .map(String)
    .join("|");
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function secondsToIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

export function chromeTimeToIso(value: unknown): string | undefined {
  const raw = typeof value === "string" ? Number(value) : value;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;

  const epochDeltaMicroseconds = 11644473600000000;
  return new Date((raw - epochDeltaMicroseconds) / 1000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function compactText(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trim()}…`;
}
