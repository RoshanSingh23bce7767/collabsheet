"use client";

import React from "react";
import { Collaborator } from "@/hooks/usePresence";

interface PresenceBarProps {
  collaborators: Record<string, Collaborator>;
}

export default function PresenceBar({ collaborators }: PresenceBarProps) {
  const collabList = Object.values(collaborators);

  return (
    <div className="flex items-center gap-1.5">
      {collabList.length === 0 && (
        <span className="text-xs font-medium text-slate-400 mr-2">No other collaborators</span>
      )}
      
      {collabList.length > 0 && (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse mr-2">
          ● Live ({collabList.length})
        </span>
      )}

      <div className="flex -space-x-1.5 overflow-hidden">
        {collabList.map((collab) => {
          const initials = collab.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase() || "?";

          return (
            <div
              key={collab.uid}
              className="relative group flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white border-2 border-white dark:border-slate-900 shadow-sm cursor-help transition-transform hover:scale-110"
              style={{ backgroundColor: collab.color }}
            >
              {initials}
              
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-40 w-44 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-medium text-white shadow-xl ring-1 ring-black/5 animate-fade-in">
                <p className="font-semibold">{collab.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {collab.activeCell ? `Viewing Cell ${collab.activeCell}` : "Idle"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
