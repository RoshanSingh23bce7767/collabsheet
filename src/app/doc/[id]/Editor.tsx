"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCells, CellDoc } from "@/hooks/useCells";
import { usePresence } from "@/hooks/usePresence";
import { useWriteState } from "@/hooks/useWriteState";
import Toolbar from "@/components/Toolbar";
import PresenceBar from "@/components/PresenceBar";
import Grid from "@/components/Grid";
import { evaluate, colToIndex, indexToCol } from "@/lib/formula";

interface EditorProps {
  docId: string;
  docTitle: string;
  isDbConfigured: boolean;
}

export default function Editor({ docId, docTitle, isDbConfigured }: EditorProps) {
  const { user } = useAuth();
  
  // 1. Hook up data hooks. Wait until user is authenticated.
  const userId = user?.uid || "anonymous";
  const { cells, loading, updateCell } = useCells(docId, userId);
  const { collaborators, updateActiveCell } = usePresence(docId, user);
  const {
    setCellWriteState,
    getCellWriteState,
    isAnyCellSaving,
    isAnyCellError,
  } = useWriteState();

  // 2. Local State Management
  const [selectedCellId, setSelectedCellId] = useState("A1");
  const [editModeCellId, setEditModeCellId] = useState<string | null>(null);
  const [formulaBarInput, setFormulaBarInput] = useState("");

  // Synchronize formula bar with active cell selection changes during render-phase
  const activeCellData = cells[selectedCellId.toUpperCase()];
  const rawVal = activeCellData?.raw ?? "";

  const [prevSelectionState, setPrevSelectionState] = useState({
    cellId: selectedCellId,
    raw: rawVal,
  });

  if (
    selectedCellId !== prevSelectionState.cellId ||
    rawVal !== prevSelectionState.raw
  ) {
    setPrevSelectionState({ cellId: selectedCellId, raw: rawVal });
    setFormulaBarInput(rawVal);
  }

  useEffect(() => {
    // Update presence tracker position
    updateActiveCell(selectedCellId);
  }, [selectedCellId, updateActiveCell]);

  // Handle cell selection
  const handleSelectCell = useCallback((cellId: string) => {
    setSelectedCellId(cellId.toUpperCase());
    setEditModeCellId(null); // Cancel edit on selection switch
  }, []);

  // Enter Cell Editing Mode
  const handleStartEdit = useCallback((cellId: string) => {
    setEditModeCellId(cellId.toUpperCase());
  }, []);

  // Commit Cell modifications to DB
  const handleCommitEdit = useCallback(
    async (cellId: string, newValue: string) => {
      const upperId = cellId.toUpperCase();
      setEditModeCellId(null);

      const currentCell = cells[upperId];
      // Skip write if the value hasn't changed to save bandwidth
      if (currentCell?.raw === newValue) {
        return;
      }

      setCellWriteState(upperId, "saving");
      try {
        await updateCell(upperId, newValue, currentCell?.format);
        setCellWriteState(upperId, "saved");
      } catch (err) {
        console.error("Failed to commit cell edit:", err);
        setCellWriteState(upperId, "error");
      }
    },
    [cells, updateCell, setCellWriteState]
  );

  // Cancel Cell editing
  const handleCancelEdit = useCallback(() => {
    setEditModeCellId(null);
  }, []);

  // Triggered when formula bar value changes
  const handleFormulaBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaBarInput(e.target.value);
  };

  // Triggered when formula bar commits
  const handleFormulaBarKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleCommitEdit(selectedCellId, formulaBarInput);
      // Blur formula bar input to return focus to grid
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const currentRaw = cells[selectedCellId]?.raw ?? "";
      setFormulaBarInput(currentRaw);
      e.currentTarget.blur();
    }
  };

  // Toggle/Change cell formatting metadata
  const handleFormatChange = useCallback(
    async (formatUpdates: Partial<CellDoc["format"]>) => {
      const currentCell = cells[selectedCellId];
      const mergedFormat = {
        ...(currentCell?.format || {}),
        ...formatUpdates,
      };

      setCellWriteState(selectedCellId, "saving");
      try {
        await updateCell(selectedCellId, currentCell?.raw ?? "", mergedFormat);
        setCellWriteState(selectedCellId, "saved");
      } catch (err) {
        console.error("Failed to update format:", err);
        setCellWriteState(selectedCellId, "error");
      }
    },
    [selectedCellId, cells, updateCell, setCellWriteState]
  );

  // Client-side CSV download export support
  const handleExportCSV = () => {
    let maxRow = 1;
    let maxColIdx = 0; // 'A' = 0

    // Find the actual grid bounds containing values
    Object.keys(cells).forEach((cellId) => {
      const match = cellId.match(/^([A-Z]+)(\d+)$/i);
      if (match) {
        const colIdx = colToIndex(match[1]);
        const row = parseInt(match[2], 10);
        if (row > maxRow) maxRow = row;
        if (colIdx > maxColIdx) maxColIdx = colIdx;
      }
    });

    // Limit standard sandbox boundary size
    maxRow = Math.min(100, maxRow);
    maxColIdx = Math.min(25, maxColIdx);

    let csvContent = "";
    for (let r = 1; r <= maxRow; r++) {
      const rowValues: string[] = [];
      for (let c = 0; c <= maxColIdx; c++) {
        const cellId = `${indexToCol(c)}${r}`;
        const val = evaluate(cellId, cells);
        const valStr = val === undefined || val === null ? "" : String(val);

        // Escape quotes
        const escaped = valStr.replace(/"/g, '""');
        if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
          rowValues.push(`"${escaped}"`);
        } else {
          rowValues.push(escaped);
        }
      }
      csvContent += rowValues.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${docTitle.replace(/\s+/g, "_")}_export.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCellData = cells[selectedCellId];
  const activeFormat = selectedCellData?.format || {};
  const evaluatedSelectedValue = evaluate(selectedCellId, cells);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading spreadsheet data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      
      {/* 1. Editor Toolbar */}
      <Toolbar
        docTitle={docTitle}
        isSaving={isAnyCellSaving}
        isError={isAnyCellError}
        activeFormat={activeFormat}
        onFormatChange={handleFormatChange}
        onExportCSV={handleExportCSV}
        isDbConfigured={isDbConfigured}
      />

      {/* 2. Collaborative Sub-Header (Formula bar and Collaborators) */}
      <div className="flex h-11 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 gap-4 bg-slate-50/50 dark:bg-slate-900/10">
        {/* Cell Identifier + Formula input bar */}
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-6 w-12 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 select-none border">
            {selectedCellId}
          </div>
          
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-600 italic select-none">
            fx
          </span>

          <input
            type="text"
            value={formulaBarInput}
            onChange={handleFormulaBarChange}
            onKeyDown={handleFormulaBarKeyDown}
            placeholder="Enter value or formula (e.g. =SUM(A1:B3) or =A1+B2)"
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Presence Avatars */}
        <PresenceBar collaborators={collaborators} />
      </div>

      {/* 3. The Grid viewport */}
      <Grid
        cells={cells}
        collaborators={collaborators}
        selectedCellId={selectedCellId}
        onSelectCell={handleSelectCell}
        editModeCellId={editModeCellId}
        onStartEdit={handleStartEdit}
        onCommitEdit={handleCommitEdit}
        onCancelEdit={handleCancelEdit}
        getCellWriteState={getCellWriteState}
      />

      {/* 4. Status Bar */}
      <footer className="h-7 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 select-none">
        <div className="flex gap-4">
          <span>Active cell: <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedCellId}</span></span>
          {selectedCellData?.raw && (
            <span>Raw: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">{selectedCellData.raw}</code></span>
          )}
          {evaluatedSelectedValue !== "" && (
            <span>Evaluated: <span className="font-semibold text-slate-600 dark:text-slate-300">{evaluatedSelectedValue}</span></span>
          )}
        </div>
        <div>
          <span>Double-click or Enter to Edit · Arrow keys to Move · Tab to shift right</span>
        </div>
      </footer>
    </div>
  );
}
