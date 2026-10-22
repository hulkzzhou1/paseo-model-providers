
export function parseTokenCount(text: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([km])?$/i.exec(text.trim());
  if (!match) return NaN;
  const exponent = match[2]?.toLowerCase() === "m" ? 6 : match[2] ? 3 : 0;
  const value = Number(`${match[1]}e${exponent}`);
  return Number.isSafeInteger(value) ? value : NaN;
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000 && value % 1_000_000 === 0) return `${value / 1_000_000}M`;
  if (value >= 1_000 && value % 1_000 === 0) return `${value / 1_000}K`;
  return String(value);
}
