import { useEffect, useState } from "react";

/* The current time in milliseconds, refreshed every minute, so screens that
   depend on "has it started yet?" stay correct without calling Date.now()
   while rendering. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
