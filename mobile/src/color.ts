/** Mixes a #RRGGBB color toward black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (target - v) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** A #RRGGBB color at [opacity] (0–1), as #RRGGBBAA. */
export function alpha(hex: string, opacity: number): string {
  return `${hex.slice(0, 7)}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;
}
