import { logEvent } from './logger';

// Patches the global console so raw console.log/warn/error calls anywhere in the app (not
// just the explicit logEvent() calls wired into PrimaryButton/navigation/etc.) also show up
// in the admin Logs screen — mirrors the same patch on the backend (see
// backend/src/logs/console-log-bridge.ts).
const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

let patched = false;

export function patchConsoleLogging(): void {
  if (patched) return;
  patched = true;
  (Object.keys(original) as Array<keyof typeof original>).forEach((method) => {
    console[method] = (...args: unknown[]) => {
      original[method](...args);
      try {
        const level = method === 'error' ? 'error' : method === 'warn' ? 'warn' : 'info';
        logEvent('console', formatArgs(args).slice(0, 500), { level: method }, level);
      } catch {
        // logging must never break the console it's patching
      }
    };
  });
}
