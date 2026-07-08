"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Cell } from "./Cell";
import { CellDoc } from "@/hooks/useCells";
import { Collaborator } from "@/hooks/usePresence";
import { WriteState } from "@/hooks/useWriteState";
import { evaluate, colToIndex, indexToCol } from "@/lib/formula";

interface GridProps {
  cells: Record<string, CellDoc>;
  collaborators: Record<string, Collaborator>;
  selectedCellId: string;
  onSelectCell: (cellId: string) => void;
  editModeCellId: string | null;
  onStartEdit: (cellId: string) => void;
  onCommitEdit: (cellId: string, newValue: string) => void;
  onCancelEdit: () => void;
  getCellWriteState: (cellId: string) => WriteState;
}

const ROW_COUNT = 100;
const COL_COUNT = 26; // A to Z

export default function Grid({
  cells,
  collaborators,
  selectedCellId,
  onSelectCell,
  editModeCellId,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  getCellWriteState,
}: GridProps) {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Generate column letters: A, B, C, ... Z
  const columns = useMemo(() => {
    return Array.from({ length: COL_COUNT }, (_, i) => String.fromCharCode(65 + i));
  }, []);

  // Generate row numbers: 1, 2, ... 100
  const rows = useMemo(() => {
    return Array.from({ length: ROW_COUNT }, (_, i) => i + 1);
  }, []);

  // Compute evaluated values for all cells to satisfy the formula engine client dependency
  const evaluatedCells = useMemo(() => {
    const result: Record<string, number | string> = {};
    Object.keys(cells).forEach((cellId) => {
      result[cellId] = evaluate(cellId, cells);
    });
    return result;
  }, [cells]);

  // Group collaborators by their active cells
  const collaboratorsByCell = useMemo(() => {
    const map: Record<string, Collaborator[]> = {};
    Object.values(collaborators).forEach((collab) => {
      if (collab.activeCell) {
        const cellId = collab.activeCell.toUpperCase();
        if (!map[cellId]) {
          map[cellId] = [];
        }
        map[cellId].push(collab);
      }
    });
    return map;
  }, [collaborators]);

  // Helper to parse cellId (e.g. B12 -> colIndex: 1, rowIndex: 12)
  const parseCellId = (id: string) => {
    const match = id.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return { col: 0, row: 1 };
    return {
      col: colToIndex(match[1]),
      row: parseInt(match[2], 10),
    };
  };

  const moveSelection = (direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
    const { col, row } = parseCellId(selectedCellId);
    let newCol = col;
    let newRow = row;

    switch (direction) {
      case "UP":
        newRow = Math.max(1, row - 1);
        break;
      case "DOWN":
        newRow = Math.min(ROW_COUNT, row + 1);
        break;
      case "LEFT":
        newCol = Math.max(0, col - 1);
        break;
      case "RIGHT":
        newCol = Math.min(COL_COUNT - 1, col + 1);
        break;
    }

    const newCellId = `${indexToCol(newCol)}${newRow}`;
    onSelectCell(newCellId);
    scrollToCell(newCol, newRow);
  };

  const scrollToCell = (colIdx: number, rowIdx: number) => {
    if (!gridContainerRef.current) return;
    
    // Each cell is 100px wide, and 32px (h-8) high
    const cellWidth = 100;
    const cellHeight = 32;

    const container = gridContainerRef.current;
    
    const cellLeft = colIdx * cellWidth;
    const cellTop = (rowIdx - 1) * cellHeight;

    const visibleWidth = container.clientWidth - 40; // Subtract index column width
    const visibleHeight = container.clientHeight - 32; // Subtract header row height

    // Horizontal Scroll adjustment
    if (cellLeft < container.scrollLeft) {
      container.scrollLeft = cellLeft;
    } else if (cellLeft + cellWidth > container.scrollLeft + visibleWidth) {
      container.scrollLeft = cellLeft + cellWidth - visibleWidth;
    }

    // Vertical Scroll adjustment
    if (cellTop < container.scrollTop) {
      container.scrollTop = cellTop;
    } else if (cellTop + cellHeight > container.scrollTop + visibleHeight) {
      container.scrollTop = cellTop + cellHeight - visibleHeight;
    }
  };

  // Keyboard navigation listener (active when cell is selected and not editing)
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editModeCellId !== null) return; // Skip if user is editing inside a cell

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveSelection("UP");
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSelection("DOWN");
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSelection("LEFT");
        break;
      case "ArrowRight":
        e.preventDefault();
        moveSelection("RIGHT");
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          moveSelection("LEFT");
        } else {
          moveSelection("RIGHT");
        }
        break;
      case "Enter":
        e.preventDefault();
        onStartEdit(selectedCellId);
        break;
      default:
        // Enter typing directly if alphanumeric is pressed on selection (similar to Google Sheets)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          onStartEdit(selectedCellId);
          onCommitEdit(selectedCellId, e.key);
        }
        break;
    }
  };

  // Keyboard forwarding inside cell editor input (to move focus after commit)
  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Commit edit is already handled, move selection down
      setTimeout(() => moveSelection("DOWN"), 50);
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Commit edit and move selection right
      const inputVal = e.currentTarget.value;
      onCommitEdit(selectedCellId, inputVal);
      setTimeout(() => moveSelection("RIGHT"), 50);
    }
  };

  // Ensure grid stays focused for keyboard inputs
  useEffect(() => {
    if (editModeCellId === null && gridContainerRef.current) {
      gridContainerRef.current.focus();
    }
  }, [selectedCellId, editModeCellId]);

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 grid-scrollbar outline-none focus:ring-1 focus:ring-blue-500/20"
      style={{ maxHeight: "calc(100vh - 170px)" }}
    >
      <div className="relative inline-flex flex-col min-w-max">
        
        {/* Sticky Header Row */}
        <div className="sticky top-0 z-20 flex h-8 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {/* Top Left Header Corner */}
          <div className="sticky left-0 z-30 h-8 w-10 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400">#</span>
          </div>

          {/* Column Letters */}
          {columns.map((col) => (
            <div
              key={col}
              className="h-8 w-[100px] shrink-0 border-r border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center select-none"
            >
              {col}
            </div>
          ))}
        </div>

        {/* Row Container */}
        <div className="flex flex-col">
          {rows.map((row) => (
            <div key={row} className="flex h-8 bg-white dark:bg-slate-900">
              
              {/* Sticky Row Index Column */}
              <div className="sticky left-0 z-10 h-8 w-10 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center select-none">
                {row}
              </div>

              {/* Data Cells */}
              {columns.map((col) => {
                const cellId = `${col}${row}`;
                const cellData = cells[cellId];
                const rawVal = cellData?.raw ?? "";
                const displayVal = evaluatedCells[cellId] ?? "";
                const formatVal = cellData?.format;
                const isSelected = selectedCellId === cellId;
                const isEditing = editModeCellId === cellId;
                const cellCollabs = collaboratorsByCell[cellId] || [];
                const writeState = getCellWriteState(cellId);

                return (
                  <Cell
                    key={cellId}
                    cellId={cellId}
                    value={displayVal}
                    raw={rawVal}
                    format={formatVal}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    collaborators={cellCollabs}
                    writeState={writeState}
                    onSelect={onSelectCell}
                    onStartEdit={onStartEdit}
                    onCommitEdit={onCommitEdit}
                    onCancelEdit={onCancelEdit}
                    onKeyDown={handleCellKeyDown}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
