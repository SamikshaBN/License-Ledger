'use client';
import { useEffect, useState } from 'react';

export async function api(path, opts = {}) {
  const { body, ...rest } = opts;
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || 'Request failed');
    e.status = res.status;
    e.details = data?.error?.details;
    throw e;
  }
  return data;
}

export const errText = (e) => e.message + (e.details ? ': ' + Object.entries(e.details).map(([k, v]) => `${k} ${v}`).join(', ') : '');

export function useMe() {
  const [me, setMe] = useState(null);
  useEffect(() => { api('/api/auth/me').then((d) => setMe(d.user)).catch(() => {}); }, []);
  return me;
}

export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((d) => alive && setState({ data: d, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => { alive = false; };
  }, [path, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
