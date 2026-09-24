import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to a new target whenever
 * `target` changes — counts up or down depending on direction, scoreboard-style.
 */
export function useAnimatedCounter(target: number, durationMs = 600): number {
  const [displayValue, setDisplayValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef(target);

  useEffect(() => {
    const startValue = startValueRef.current;
    const diff = target - startValue;

    // Nothing to animate — value didn't change.
    if (diff === 0) {
      setDisplayValue(target);
      return;
    }

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out — starts fast, settles smoothly, feels more natural than linear.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;

      setDisplayValue(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startValueRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return displayValue;
}