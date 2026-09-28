/**
 * Public availability, fetched in windows and merged into one map by date.
 * The calendar asks for three months at a time and refetches as people navigate.
 */
import { useCallback, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { toKey } from '../../shared/dates';
import type { AvailabilityDay, DateKey } from '../../shared/types';

export interface YM {
  y: number;
  m: number;
}

export const ymIndex = (ym: YM) => ym.y * 12 + (ym.m - 1);
export const fromIndex = (i: number): YM => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
export const addMonths = (ym: YM, n: number): YM => fromIndex(ymIndex(ym) + n);
export const lastDayOf = (ym: YM) => new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
export const firstKey = (ym: YM): DateKey => toKey(ym.y, ym.m, 1);
export const lastKey = (ym: YM): DateKey => toKey(ym.y, ym.m, lastDayOf(ym));
export const ymOf = (key: DateKey): YM => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) });

const monthsIn = (from: DateKey, to: DateKey): number[] => {
  const out: number[] = [];
  for (let i = ymIndex(ymOf(from)); i <= ymIndex(ymOf(to)); i++) out.push(i);
  return out;
};

export function useAvailability() {
  const [days, setDays] = useState<Record<DateKey, AvailabilityDay>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<number>());
  const seq = useRef(0);
  const last = useRef<{ from: DateKey; to: DateKey } | null>(null);

  const load = useCallback(async (from: DateKey, to: DateKey) => {
    last.current = { from, to };
    const id = ++seq.current;
    const months = monthsIn(from, to);
    months.forEach((m) => requested.current.add(m));
    setLoading(true);
    setError(null);
    const res = await api.availability(from, to);
    if (isError(res)) {
      months.forEach((m) => requested.current.delete(m));
    } else {
      setDays((prev) => {
        const next = { ...prev };
        for (const d of res.days) next[d.date] = d;
        return next;
      });
    }
    if (id === seq.current) {
      setLoading(false);
      setError(isError(res) ? res.error : null);
    }
    return !isError(res);
  }, []);

  /** Make sure `count` months starting at `view` are loaded. */
  const ensureMonths = useCallback(
    (view: YM, count = 3) => {
      const start = ymIndex(view);
      let missing = false;
      for (let i = start; i < start + count; i++) if (!requested.current.has(i)) missing = true;
      if (!missing) return;
      void load(firstKey(view), lastKey(fromIndex(start + count - 1)));
    },
    [load],
  );

  const retry = useCallback(() => {
    if (last.current) void load(last.current.from, last.current.to);
  }, [load]);

  return { days, loading, error, load, ensureMonths, retry };
}
