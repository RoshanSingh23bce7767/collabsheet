"use client";

import React, { useState, useEffect, useRef } from "react";
import { WriteState } from "@/hooks/useWriteState";
import { Collaborator } from "@/hooks/usePresence";

interface CellProps {
  cellId: string;
  value: number | string;
  raw: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fillColor?: string;
  };
  isSelected: boolean;
  isEditing: boolean;
  collaborators: Collaborator[];
  writeState: WriteState;
  onSelect: (cellId: string) => void;
  onStartEdit: (cellId: string) => void;
  onCommitEdit: (cellId: string, newValue: string) => void;
  onCancelEdit: () => void;
  // Let parent handle coordinate movements for focus shifting
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const Cell = React.memo(
  function Cell({
    cellId,
    value,
    raw,
    format,
    isSelected,
    isEditing,
    collaborators,
    writeState,
    onSelect,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onKeyDown,
  }: CellProps) {
    const [inputValue, setInputValue] = useState(raw);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input value with raw changes (e.g. from collaborative updates)
    useEffect(() => {
      if (!isEditing) {
        setInputValue(raw);
      }
    }, [raw, isEditing]);

    // Auto-focus input when entering edit mode
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select(); // Highlight entire text to behave like Excel
      }
    }, [isEditing]);

    const handleBlur = () => {
      onCommitEdit(cellId, inputValue);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommitEdit(cellId, inputValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setInputValue(raw); // Reset to original
        onCancelEdit();
      } else {
        // Forward other navigation keys to parent
        onKeyDown(e);
      }
    };

    // Styling overrides from cell formatting metadata
    const customStyle: React.CSSProperties = {
      fontWeight: format?.bold ? "bold" : "normal",
      fontStyle: format?.italic ? "italic" : "normal",
      color: format?.color || undefined,
      backgroundColor: format?.fillColor || undefined,
    };

    // Determine cell border styles
    let borderClass = "border-slate-200/60 dark:border-slate-800/60";
    let borderStyle: React.CSSProperties = {};

    if (isSelected) {
      borderClass = "ring-2 ring-blue-500 z-10 shadow-sm";
    } else if (collaborators.length > 0) {
      // Draw collaborator selection border using their designated color
      const primaryCollab = collaborators[0];
      borderStyle = {
        boxShadow: `0 0 0 2px ${primaryCollab.color} inset`,
        zIndex: 5,
      };
    }

    return (
      <div
        onClick={() => !isEditing && onSelect(cellId)}
        onDoubleClick={() => !isEditing && onStartEdit(cellId)}
        style={{ ...customStyle, ...borderStyle }}
        className={`relative h-8 min-w-[100px] border-r border-b px-2 py-1 text-xs select-none cursor-cell outline-none transition-all duration-75 flex items-center ${borderClass}`}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleInputKeyDown}
            className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white border border-blue-500 focus:outline-none z-20"
          />
        ) : (
          <div className="w-full truncate text-left pointer-events-none select-none">
            {/* Show value. If formula errors out, styled accordingly */}
            {String(value).startsWith("#") ? (
              <span className="text-red-500 font-semibold">{value}</span>
            ) : (
              value
            )}
          </div>
        )}

        {/* Per-cell Write-State Indicator (small indicator in bottom right corner) */}
        {!isEditing && writeState !== "idle" && (
          <div className="absolute right-1 bottom-1 flex h-1.5 w-1.5 items-center justify-center">
            {writeState === "saving" && (
              <span className="h-1 w-1 animate-ping rounded-full bg-amber-400 opacity-75"></span>
            )}
            {writeState === "saved" && (
              <span className="h-1 w-1 rounded-full bg-emerald-500 transition-opacity duration-1000"></span>
            )}
            {writeState === "error" && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Error saving cell"></span>
            )}
          </div>
        )}

        {/* Collaborator Cursor Badge overlay (visible on selection/hover) */}
        {!isEditing && collaborators.length > 0 && (
          <div
            className="absolute left-1 -top-2 px-1 rounded text-[8px] font-bold text-white z-30 opacity-90 pointer-events-none"
            style={{ backgroundColor: collaborators[0].color }}
          >
            {collaborators[0].name.split(" ")[0]}
          </div>
        )}
      </div>
    );
  },
  // Custom comparison to ensure re-renders only occur when state changes
  (prevProps, nextProps) => {
    return (
      prevProps.cellId === nextProps.cellId &&
      prevProps.value === nextProps.value &&
      prevProps.raw === nextProps.raw &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.writeState === nextProps.writeState &&
      prevProps.format?.bold === nextProps.format?.bold &&
      prevProps.format?.italic === nextProps.format?.italic &&
      prevProps.format?.color === nextProps.format?.color &&
      prevProps.format?.fillColor === nextProps.format?.fillColor &&
      prevProps.collaborators.length === nextProps.collaborators.length &&
      prevProps.collaborators.every(
        (collab, idx) =>
          collab.uid === nextProps.collaborators[idx]?.uid &&
          collab.color === nextProps.collaborators[idx]?.color &&
          collab.activeCell === nextProps.collaborators[idx]?.activeCell
      )
    );
  }
);
