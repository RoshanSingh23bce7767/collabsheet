import { useState, useCallback, useRef } from "react";

export type WriteState = "idle" | "dirty" | "saving" | "saved" | "error";

export function useWriteState() {
  const [states, setStates] = useState<Record<string, WriteState>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const setCellWriteState = useCallback((cellId: string, state: WriteState) => {
    const upperId = cellId.toUpperCase();
    
    setStates((prev) => ({
      ...prev,
      [upperId]: state,
    }));

    // Clear any existing timers for this cell
    if (timeoutRefs.current[upperId]) {
      clearTimeout(timeoutRefs.current[upperId]);
      delete timeoutRefs.current[upperId];
    }

    // If state is 'saved', fade back to 'idle' after 1.5s
    if (state === "saved") {
      timeoutRefs.current[upperId] = setTimeout(() => {
        setStates((prev) => ({
          ...prev,
          [upperId]: "idle",
        }));
        delete timeoutRefs.current[upperId];
      }, 1500);
    }
  }, []);

  const getCellWriteState = useCallback(
    (cellId: string): WriteState => {
      return states[cellId.toUpperCase()] || "idle";
    },
    [states]
  );

  // Check if there are any pending saves
  const isAnyCellSaving = Object.values(states).some(
    (s) => s === "saving" || s === "dirty"
  );

  const isAnyCellError = Object.values(states).some((s) => s === "error");

  return {
    setCellWriteState,
    getCellWriteState,
    isAnyCellSaving,
    isAnyCellError,
  };
}
