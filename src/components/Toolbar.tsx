"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bold,
  Italic,
  Download,
  ChevronLeft,
  Loader2,
  CloudCheck,
  CloudLightning,
  Palette,
  Type,
} from "lucide-react";

interface ToolbarProps {
  docTitle: string;
  isSaving: boolean;
  isError: boolean;
  activeFormat: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fillColor?: string;
  };
  onFormatChange: (format: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fillColor?: string;
  }) => void;
  onExportCSV: () => void;
  isDbConfigured: boolean;
}

const PRESET_TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Orange", value: "#F59E0B" },
];

const PRESET_FILL_COLORS = [
  { name: "None", value: "" },
  { name: "Soft Red", value: "#FEE2E2" },
  { name: "Soft Blue", value: "#DBEAFE" },
  { name: "Soft Green", value: "#D1FAE5" },
  { name: "Soft Yellow", value: "#FEF3C7" },
  { name: "Soft Purple", value: "#EDE9FE" },
];

export default function Toolbar({
  docTitle,
  isSaving,
  isError,
  activeFormat,
  onFormatChange,
  onExportCSV,
  isDbConfigured,
}: ToolbarProps) {
  const [showTextMenu, setShowTextMenu] = useState(false);
  const [showFillMenu, setShowFillMenu] = useState(false);

  const toggleBold = () => {
    onFormatChange({ bold: !activeFormat.bold });
  };

  const toggleItalic = () => {
    onFormatChange({ italic: !activeFormat.italic });
  };

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* Top Header Row */}
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white truncate max-w-xs md:max-w-md">
              {docTitle}
            </h1>
            {!isDbConfigured && (
              <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/20">
                Sandbox Mode
              </span>
            )}
          </div>
        </div>

        {/* Sync Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border">
            {isError ? (
              <span className="flex items-center gap-1.5 text-red-600 border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20 px-2 py-0.5 rounded-full">
                <CloudLightning className="h-3.5 w-3.5" />
                Connection Error
              </span>
            ) : isSaving ? (
              <span className="flex items-center gap-1.5 text-amber-600 border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving changes...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                <CloudCheck className="h-3.5 w-3.5" />
                All changes saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Formatting & Controls Sub-Row */}
      <div className="flex h-11 items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-1 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-1">
          {/* Bold Button */}
          <button
            onClick={toggleBold}
            className={`rounded-lg p-1.5 transition-colors ${
              activeFormat.bold
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>

          {/* Italic Button */}
          <button
            onClick={toggleItalic}
            className={`rounded-lg p-1.5 transition-colors ${
              activeFormat.italic
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTextMenu(!showTextMenu);
                setShowFillMenu(false);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Text Color"
            >
              <Type className="h-4 w-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Text</span>
            </button>

            {showTextMenu && (
              <div className="absolute left-0 mt-1.5 w-32 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg ring-1 ring-black/5 z-40">
                {PRESET_TEXT_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => {
                      onFormatChange({ color: color.value });
                      setShowTextMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-slate-200 dark:border-slate-800"
                      style={{ backgroundColor: color.value || "#000000" }}
                    ></span>
                    {color.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fill Color Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFillMenu(!showFillMenu);
                setShowTextMenu(false);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Fill Color"
            >
              <Palette className="h-4 w-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Fill</span>
            </button>

            {showFillMenu && (
              <div className="absolute left-0 mt-1.5 w-32 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg ring-1 ring-black/5 z-40">
                {PRESET_FILL_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => {
                      onFormatChange({ fillColor: color.value });
                      setShowFillMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span
                      className="h-3 w-3 rounded border border-slate-200 dark:border-slate-800"
                      style={{ backgroundColor: color.value || "transparent" }}
                    ></span>
                    {color.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* CSV Export Button */}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-semibold text-xs px-3 py-1.5 shadow-sm transition-colors"
            title="Export to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
