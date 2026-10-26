import { useEffect, useState } from 'react';

type Options = { from?: number; delay?: number; durationMs?: number };

/** A whole number that counts from [from] up to [to], for "+2" tickers and score totals. */
export function useCountUp(to: number, { from = 0, delay = 0, durationMs = 600 }: Options = {}): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (to === from) return;
    let frame: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      const began = Date.now();
      frame = setInterval(() => {
        const t = Math.min(1, (Date.now() - began) / durationMs);
        setValue(Math.round(from + (to - from) * t));
        if (t === 1) clearInterval(frame);
      }, 40);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(frame);
    };
  }, [to, from, delay, durationMs]);
  return to === from ? to : value;
}
