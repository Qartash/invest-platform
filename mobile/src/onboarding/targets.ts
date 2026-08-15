/**
 * The bridge between a tour step, which names an element as a string, and the element
 * itself, which only exists while its screen is mounted.
 *
 * A `TourTarget` puts a measuring function in here on mount and takes it out on unmount, so
 * asking for a target is always a question about the tree as it is right now — never a
 * stale ref to a screen the user has left.
 */

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Measurer = () => Promise<TargetRect | null>;

const measurers = new Map<string, Measurer>();

export function registerTarget(id: string, measure: Measurer): () => void {
  measurers.set(id, measure);
  return () => {
    // Guarded: during a navigation the next screen can register its target before the
    // previous one has run its cleanup, and an unguarded delete would remove the new one.
    if (measurers.get(id) === measure) measurers.delete(id);
  };
}

export function measureTarget(id: string): Promise<TargetRect | null> {
  const measure = measurers.get(id);
  return measure ? measure() : Promise.resolve(null);
}

/**
 * Waits for a target to be mounted and laid out.
 *
 * A step usually arrives just after a navigation, so the element it points at is a frame or
 * two away from existing. Rather than have every caller guess a delay, poll briefly and give
 * up — a `null` here is not a failure, it's the overlay's cue to centre the card instead.
 */
export async function awaitTarget(id: string, timeoutMs = 1500): Promise<TargetRect | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rect = await measureTarget(id);
    if (rect) return rect;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
