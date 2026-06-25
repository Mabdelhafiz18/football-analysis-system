export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function readNumber(value: unknown, ...keys: string[]): number | null {
  const object = asRecord(value);
  for (const key of keys) {
    const candidate = object[key];
    const parsed = typeof candidate === "number" ? candidate : Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readString(value: unknown, ...keys: string[]): string | null {
  const object = asRecord(value);
  for (const key of keys) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (typeof candidate === "number") return String(candidate);
  }
  return null;
}

export function readBoolean(value: unknown, ...keys: string[]): boolean | null {
  const object = asRecord(value);
  for (const key of keys) {
    if (typeof object[key] === "boolean") return object[key] as boolean;
  }
  return null;
}

export function deepFindArrays(value: unknown, keys: string[], depth = 0): unknown[] {
  if (depth > 7) return [];
  if (isRecord(value)) {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key] as unknown[];
    }
    for (const child of Object.values(value)) {
      const found = deepFindArrays(child, keys, depth + 1);
      if (found.length) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = deepFindArrays(child, keys, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

export function deepFindObject(
  value: unknown,
  predicate: (item: UnknownRecord) => boolean,
  depth = 0,
): UnknownRecord | null {
  if (depth > 7) return null;
  if (isRecord(value)) {
    if (predicate(value)) return value;
    for (const child of Object.values(value)) {
      const found = deepFindObject(child, predicate, depth + 1);
      if (found) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = deepFindObject(child, predicate, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function formatMatchTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatPercentage(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(digits)}%`;
}
