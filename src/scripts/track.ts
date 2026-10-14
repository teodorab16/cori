// First-party, cookieless event log. Nothing personal goes in here: never an email address.
// Without PUBLIC_EVENTS_URL the events go to the console and window.__coriEvents (development).
import { ENDPOINTS } from '../config';

type Props = Record<string, unknown>;

const OPT_OUT_KEY = 'cori-no-count';
const queue: Props[] = [];
let flushTimer: number | undefined;
let base: Props = {};

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: Storage, key: string, value: string | null): void {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the site still works, it just forgets.
  }
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionId(): string {
  let id = safeGet(sessionStorage, 'cori-session');
  if (!id) {
    id = randomId();
    safeSet(sessionStorage, 'cori-session', id);
  }
  return id;
}

export function inAppBrowser(): string {
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return 'ig';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'fb';
  if (/WhatsApp/i.test(ua)) return 'wa';
  if (/TikTok|musical_ly/i.test(ua)) return 'tt';
  return 'none';
}

export function attribution(): Props {
  const params = new URLSearchParams(location.search);
  const out: Props = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 80);
  }
  if (document.referrer) {
    try {
      out.referrer = new URL(document.referrer).hostname;
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function isOptedOut(): boolean {
  return safeGet(localStorage, OPT_OUT_KEY) === '1';
}

export function setOptedOut(value: boolean): void {
  safeSet(localStorage, OPT_OUT_KEY, value ? '1' : null);
}

export function initTracking(extra: Props): void {
  base = {
    s: sessionId(),
    inapp: inAppBrowser(),
    motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
    vw: window.innerWidth,
    ...attribution(),
    ...extra,
  };
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);
}

export function track(event: string, props: Props = {}): void {
  if (isOptedOut()) return;
  const entry = { e: event, t: new Date().toISOString(), ...base, ...props };
  if (!ENDPOINTS.events) {
    const w = window as unknown as { __coriEvents?: Props[] };
    (w.__coriEvents ??= []).push(entry);
    console.debug('[cori event]', event, props);
    return;
  }
  queue.push(entry);
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, 4000);
}

function flush(): void {
  if (!ENDPOINTS.events || queue.length === 0) return;
  const body = JSON.stringify({ events: queue.splice(0, queue.length) });
  // text/plain keeps sendBeacon a "simple" request, so no CORS preflight is needed.
  const sent = navigator.sendBeacon?.(ENDPOINTS.events, new Blob([body], { type: 'text/plain' }));
  if (!sent) {
    fetch(ENDPOINTS.events, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  }
}
