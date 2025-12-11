import { useCallback, useEffect, useRef } from "react";

// Kendalikan progres pseudo-indeterminate saat menjalankan prompt.
// Dibuat smooth dan lebih lambat agar tidak terasa tersendat.
export function useFeatureProgress(setter) {
  const timerRef = useRef(null);
  const capWhileRunning = 98; // tahan sebelum 100% sampai benar-benar selesai

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (initialValue = 6) => {
      clearTimer();
      setter(Math.max(1, initialValue));
      timerRef.current = setInterval(() => {
        setter((prev) => {
          if (prev >= capWhileRunning) return prev;
          // Langkah lebih kecil supaya bergerak lebih pelan tapi konsisten.
          const gap = capWhileRunning - prev;
          const increment = Math.max(0.15, gap * 0.035);
          return Math.min(prev + increment, capWhileRunning);
        });
      }, 600);
    },
    [capWhileRunning, clearTimer, setter]
  );

  const bump = useCallback(
    (floorValue = 0) => {
      setter((prev) => {
        const next = Math.max(prev, floorValue);
        return next > capWhileRunning ? capWhileRunning : next;
      });
    },
    [capWhileRunning, setter]
  );

  const complete = useCallback(
    (resetDelay = 750) => {
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
