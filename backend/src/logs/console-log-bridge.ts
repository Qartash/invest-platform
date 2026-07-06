// Patches the global console so that anything printed to the server terminal — framework
// startup lines, route mappings, stray console.log/error calls anywhere in the codebase —
// also lands in the same system_logs table the rest of this module writes to. Patched at
// import time (main.ts imports this file first) so even the earliest bootstrap output is
// captured once LogsService is ready to receive it.
export type ConsoleLogWriter = (level: 'info' | 'warn' | 'error', message: string) => void;

let writer: ConsoleLogWriter | null = null;

export function setConsoleLogWriter(fn: ConsoleLogWriter): void {
  writer = fn;
}

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

(Object.keys(original) as Array<keyof typeof original>).forEach((method) => {
  console[method] = (...args: unknown[]) => {
    original[method](...args);
    if (!writer) return;
    try {
      const level = method === 'error' ? 'error' : method === 'warn' ? 'warn' : 'info';
      writer(level, formatArgs(args));
    } catch {
      // logging must never break the console it's patching
    }
  };
});
