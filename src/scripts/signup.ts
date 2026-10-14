// Sends a sign-up to the backend. Until PUBLIC_SIGNUP_URL is set, sign-ups are kept in this
// browser's localStorage under "cori-dev-signups" so the flow can be tested end to end.
import { ENDPOINTS } from '../config';

export interface SignupPayload {
  email: string;
  size: string;
  ukSize: string | null;
  newsletter: boolean;
  loved: string[];
  passed: string[];
  top: string | null;
  order: string[];
  session: string;
  catalog: string;
  consent: { version: string; launchEmail: string; newsletter: string | null };
  attribution: Record<string, unknown>;
  submittedAt: string;
  flags: { fast: boolean }; // filled in under 2.5 s: possibly a bot, let the backend decide
}

const OUTBOX = 'cori-outbox';

function readList(key: string): SignupPayload[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeList(key: string, list: SignupPayload[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
}

class SignupError extends Error {
  constructor(readonly status: number) {
    super(`Signup failed: ${status}`);
  }
  // 4xx other than timeout/rate-limit means the request itself is bad: retrying won't help.
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

async function post(payload: SignupPayload): Promise<void> {
  const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(ENDPOINTS.signup, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: timeout,
  });
  if (!res.ok) throw new SignupError(res.status);
}

function removeFromOutbox(email: string): void {
  writeList(OUTBOX, readList(OUTBOX).filter((p) => p.email !== email));
}

export async function submitSignup(payload: SignupPayload): Promise<{ dev: boolean }> {
  if (!ENDPOINTS.signup) {
    writeList('cori-dev-signups', [...readList('cori-dev-signups'), payload]);
    await new Promise((resolve) => setTimeout(resolve, 650));
    return { dev: true };
  }
  try {
    await post(payload);
    removeFromOutbox(payload.email); // an earlier failed attempt must not be re-sent
    return { dev: false };
  } catch (error) {
    // Keep it so a flaky connection in a park doesn't lose the sign-up; retried on the next visit.
    if (!(error instanceof SignupError && error.permanent)) {
      writeList(OUTBOX, [...readList(OUTBOX).filter((p) => p.email !== payload.email), payload]);
    }
    throw error;
  }
}

export async function retryOutbox(onSent?: () => void): Promise<void> {
  if (!ENDPOINTS.signup) return;
  for (const payload of readList(OUTBOX)) {
    try {
      await post(payload);
      removeFromOutbox(payload.email);
      onSent?.();
    } catch (error) {
      if (error instanceof SignupError && error.permanent) removeFromOutbox(payload.email);
    }
  }
}
