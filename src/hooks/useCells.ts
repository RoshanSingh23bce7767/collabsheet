import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CellDoc {
  raw: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fillColor?: string;
  };
  updatedBy: string;
  updatedAt?: unknown;
}

export function useCells(docId: string, userId: string) {
  const isDummyKey =
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "AIzaSyDummyKeyForBuildAndTesting";
  const [cells, setCells] = useState<Record<string, CellDoc>>({});
  const [loading, setLoading] = useState(true);
  const [isOfflineFallback, setIsOfflineFallback] = useState(isDummyKey);

  // Initialize cells from local storage after mount if sandbox
  useEffect(() => {
    if (isOfflineFallback) {
      const stored = localStorage.getItem(`collabsheet_cells_${docId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTimeout(() => {
            setCells(parsed);
            setLoading(false);
          }, 0);
        } catch (e) {
          console.error("Failed to parse sandbox cells", e);
          setTimeout(() => {
            setLoading(false);
          }, 0);
        }
      } else {
        setTimeout(() => {
          setLoading(false);
        }, 0);
      }
    }
  }, [docId, isOfflineFallback]);

  useEffect(() => {
    // Check if configuration is using placeholder keys
    if (isOfflineFallback) {
      // Listen to storage events to sync across browser tabs in Sandbox Mode
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `collabsheet_cells_${docId}`) {
          if (e.newValue) {
            try {
              setCells(JSON.parse(e.newValue));
            } catch (err) {
              console.error("Failed to sync cells from storage event", err);
            }
          } else {
            setCells({});
          }
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }

    const colRef = collection(db!, "documents", docId, "cells");

    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        setCells((prev) => {
          const next = { ...prev };
          snapshot.docChanges().forEach((change) => {
            const cellId = change.doc.id.toUpperCase();
            if (change.type === "removed") {
              delete next[cellId];
            } else {
              next[cellId] = change.doc.data() as CellDoc;
            }
          });
          return next;
        });
        setLoading(false);
      },
      (error) => {
        console.warn("Firestore error, falling back to local storage:", error);
        setIsOfflineFallback(true);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [docId, isOfflineFallback]);

  // Expose a commit function that writeState hook or Grid component can trigger
  const updateCell = useCallback(
    async (cellId: string, raw: string, format?: CellDoc["format"]): Promise<void> => {
      const upperCellId = cellId.toUpperCase();
      const updatedCell: CellDoc = {
        raw,
        updatedBy: userId,
        ...(format ? { format } : {}),
      };

      let newCells: Record<string, CellDoc> = {};
      // Optimistically update local state
      setCells((prev) => {
        const next = {
          ...prev,
          [upperCellId]: {
            ...prev[upperCellId],
            ...updatedCell,
          },
        };
        // Clean up empty cells to save space (matching Firestore delete)
        if (raw === "" && (!format || Object.keys(format).length === 0)) {
          delete next[upperCellId];
        }
        newCells = next;
        return next;
      });

      if (isOfflineFallback) {
        // Persist to local storage in Sandbox Mode
        localStorage.setItem(`collabsheet_cells_${docId}`, JSON.stringify(newCells));
        
        // Dispatch a custom event to notify other components/hooks in the same tab
        window.dispatchEvent(
          new CustomEvent(`collabsheet_cells_changed_${docId}`, { detail: newCells })
        );
        return;
      }

      try {
        const cellRef = doc(db!, "documents", docId, "cells", upperCellId);
        if (raw === "" && (!format || Object.keys(format).length === 0)) {
          // Clean up empty cells to save space
          await deleteDoc(cellRef);
        } else {
          await setDoc(
            cellRef,
            {
              ...updatedCell,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("Firestore cell save error:", err);
        throw err;
      }
    },
    [docId, userId, isOfflineFallback]
  );

  // Sync state changes from same-tab events
  useEffect(() => {
    if (!isOfflineFallback) return;
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, CellDoc>>;
      setCells(customEvent.detail);
    };
    window.addEventListener(`collabsheet_cells_changed_${docId}`, handleLocalChange);
    return () => window.removeEventListener(`collabsheet_cells_changed_${docId}`, handleLocalChange);
  }, [docId, isOfflineFallback]);

  return { cells, loading, updateCell, isOfflineFallback };
}
