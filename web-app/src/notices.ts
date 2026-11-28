export type NoticeKind = "error" | "success" | "notice";

export type Notice = {
  id: number;
  kind: NoticeKind;
  message: string;
  leaving: boolean;
};

const exitMs = 220;

const durations: Record<NoticeKind, number> = {
  error: 9000,
  notice: 7000,
  success: 5200,
};

type Clock = {
  remaining: number;
  startedAt: number;
  timer: number;
  holds: number;
};

const listeners = new Set<(items: Notice[]) => void>();
const clocks = new Map<number, Clock>();
let items: Notice[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(items);
}

function clearClock(id: number) {
  const clock = clocks.get(id);
  if (!clock) return;
  window.clearTimeout(clock.timer);
  clocks.delete(id);
}

function startClock(id: number, remaining: number) {
  const timer = window.setTimeout(() => dismissNotice(id), remaining);
  clocks.set(id, { remaining, startedAt: Date.now(), timer, holds: 0 });
}

export function notify(message: string, kind: NoticeKind = "notice") {
  const text = message.trim();
  if (!text || items.some((item) => !item.leaving && item.kind === kind && item.message === text)) return;

  const notice: Notice = { id: nextId++, kind, message: text, leaving: false };
  items = [notice, ...items];
  startClock(notice.id, durations[kind]);
  const overflow = items.filter((item) => !item.leaving).slice(3);
  for (const item of overflow) dismissNotice(item.id);
  emit();
}

export function reportError(message: string) {
  notify(message, "error");
}

export function reportSuccess(message: string) {
  notify(message, "success");
}

export function reportNotice(message: string) {
  notify(message, "notice");
}

export function holdNotice(id: number) {
  const clock = clocks.get(id);
  if (!clock) return;
  if (clock.holds === 0) {
    window.clearTimeout(clock.timer);
    clock.remaining = Math.max(0, clock.remaining - (Date.now() - clock.startedAt));
    clock.timer = 0;
  }
  clock.holds += 1;
}

export function releaseNotice(id: number) {
  const clock = clocks.get(id);
  if (!clock || clock.holds === 0) return;
  clock.holds -= 1;
  if (clock.holds > 0) return;
  if (clock.remaining <= 0) {
    dismissNotice(id);
    return;
  }
  clock.startedAt = Date.now();
  clock.timer = window.setTimeout(() => dismissNotice(id), clock.remaining);
}

export function dismissNotice(id: number) {
  const current = items.find((item) => item.id === id);
  if (!current || current.leaving) return;
  clearClock(id);
  items = items.map((item) => (item.id === id ? { ...item, leaving: true } : item));
  emit();
  const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : exitMs;
  window.setTimeout(() => {
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return;
    items = next;
    emit();
  }, wait);
}

export function subscribeNotices(listener: (items: Notice[]) => void) {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}
