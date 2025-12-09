import { useCallback, useEffect, useRef } from "react";

// Kendalikan progres pseudo-indeterminate saat menjalankan prompt.
// Naik perlahan ke 90% lalu dituntaskan saat proses selesai.
export function useFeatureProgress(setter) {
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (initialValue = 10) => {
      clearTimer();
      setter(Math.max(1, initialValue));
      timerRef.current = setInterval(() => {
        setter((prev) => {
          if (prev >= 92) return prev;
          const increment = Math.max(1, Math.round((100 - prev) * 0.06));
          return Math.min(prev + increment, 92);
        });
      }, 450);
    },
    [clearTimer, setter]
  );

  const bump = useCallback(
    (floorValue = 0) => {
      setter((prev) => {
        const next = Math.max(prev, floorValue);
        return next > 96 ? 96 : next;
      });
    },
    [setter]
  );

  const complete = useCallback(
    (resetDelay = 650) => {
      clearTimer();
      setter(100);
      setTimeout(() => setter(0), resetDelay);
    },
    [clearTimer, setter]
  );

  const fail = useCallback(() => {
    clearTimer();
    setter(0);
  }, [clearTimer, setter]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { start, bump, complete, fail };
}
