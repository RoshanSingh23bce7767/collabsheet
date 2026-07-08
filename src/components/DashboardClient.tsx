"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { createDocument, renameDocument, deleteDocument } from "@/app/actions";
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Edit3,
  LogOut,
  Calendar,
  User,
  Search,
  MoreVertical,
} from "lucide-react";

export interface DashboardDoc {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  lastModified: string;
}

interface DashboardClientProps {
  initialDocs: DashboardDoc[];
  isDbConfigured: boolean;
}

export default function DashboardClient({ initialDocs, isDbConfigured }: DashboardClientProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DashboardDoc[]>(initialDocs);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync sandbox docs from localStorage if in Sandbox Mode
  React.useEffect(() => {
    if (!isDbConfigured) {
      const stored = localStorage.getItem("collabsheet_sandbox_docs");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as DashboardDoc[];
          setTimeout(() => {
            setDocs(parsed);
          }, 0);
        } catch (e) {
          console.error("Failed to parse sandbox docs", e);
        }
      } else {
        localStorage.setItem("collabsheet_sandbox_docs", JSON.stringify(initialDocs));
      }
    }
  }, [isDbConfigured, initialDocs]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setErrorMsg("");
    const title = newTitle.trim() || "Untitled Spreadsheet";

    if (!isDbConfigured) {
      const newId = `sandbox-${Math.random().toString(36).substring(2, 9)}`;
      const newDoc: DashboardDoc = {
        id: newId,
        title,
        ownerId: user?.uid || "local-user",
        ownerName: user?.name || "Local User",
        lastModified: new Date().toLocaleString(),
      };
      const updated = [newDoc, ...docs];
      setDocs(updated);
      localStorage.setItem("collabsheet_sandbox_docs", JSON.stringify(updated));
      router.push(`/doc/${newId}`);
      setCreating(false);
      setNewTitle("");
      return;
    }

    try {
      const res = await createDocument(title);
      if (res.success && res.data) {
        router.push(`/doc/${res.data.id}`);
      } else {
        setErrorMsg(res.error || "Failed to create spreadsheet.");
      }
    } catch {
      setErrorMsg("Failed to create spreadsheet.");
    } finally {
      setCreating(false);
      setNewTitle("");
    }
  };

  const handleRename = async (id: string) => {
    if (!renameTitle.trim()) return;
    setErrorMsg("");

    if (!isDbConfigured) {
      const updated = docs.map((doc) =>
        doc.id === id
          ? { ...doc, title: renameTitle.trim(), lastModified: new Date().toLocaleString() }
          : doc
      );
      setDocs(updated);
      localStorage.setItem("collabsheet_sandbox_docs", JSON.stringify(updated));
      setRenamingId(null);
      setMenuOpenId(null);
      return;
    }

    try {
      const res = await renameDocument(id, renameTitle.trim());
      if (res.success) {
        setDocs(
          docs.map((doc) =>
            doc.id === id
              ? { ...doc, title: renameTitle.trim(), lastModified: "Just now" }
              : doc
          )
        );
        setRenamingId(null);
        setMenuOpenId(null);
      } else {
        setErrorMsg(res.error || "Failed to rename spreadsheet.");
      }
    } catch {
      setErrorMsg("Failed to rename spreadsheet.");
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg("");

    if (!isDbConfigured) {
      const updated = docs.filter((doc) => doc.id !== id);
      setDocs(updated);
      localStorage.setItem("collabsheet_sandbox_docs", JSON.stringify(updated));
      localStorage.removeItem(`collabsheet_cells_${id}`);
      setDeletingId(null);
      setMenuOpenId(null);
      return;
    }

    try {
      const res = await deleteDocument(id);
      if (res.success) {
        setDocs(docs.filter((doc) => doc.id !== id));
        setDeletingId(null);
        setMenuOpenId(null);
      } else {
        setErrorMsg(res.error || "Failed to delete spreadsheet.");
      }
    } catch {
      setErrorMsg("Failed to delete spreadsheet.");
    }
  };

  const filteredDocs = docs.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xl shadow-inner">
            📊
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Collabsheet
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border border-slate-200/50 dark:border-slate-700/50">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: user?.color || "#3b82f6" }}
            ></div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {user?.name}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-500/10 dark:text-slate-400 dark:hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-8 py-10 max-w-7xl mx-auto w-full">

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              My Spreadsheets
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create, manage, and collaborate on spreadsheets in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => {
                setNewTitle("");
                setCreating(true);
                handleCreate();
              }}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 shadow-sm disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Sheet
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Grid List */}
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-2xl shadow-inner mb-4">
              📂
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No spreadsheets found
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? "Try a different search query." : "Create your first collaborative spreadsheet to get started."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Spreadsheet
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => router.push(`/doc/${doc.id}`)}
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xl group-hover:scale-105 transition-transform duration-200"
                  >
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {menuOpenId === doc.id && (
                      <div className="absolute right-0 mt-1 w-36 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg ring-1 ring-black/5 z-20">
                        <button
                          onClick={() => {
                            setRenamingId(doc.id);
                            setRenameTitle(doc.title);
                            setMenuOpenId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        {user?.uid === doc.ownerId && (
                          <button
                            onClick={() => {
                              setDeletingId(doc.id);
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  {renamingId === doc.id ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename(doc.id)}
                        className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(doc.id)}
                        className="rounded bg-blue-600 hover:bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h3
                      onClick={() => router.push(`/doc/${doc.id}`)}
                      className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer truncate"
                    >
                      {doc.title}
                    </h3>
                  )}

                  <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400/80" />
                      <span className="truncate">
                        Owner:{" "}
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {doc.ownerId === user?.uid ? "You" : doc.ownerName}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400/80" />
                      <span>Edited: {doc.lastModified}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {doc.ownerId === user?.uid ? "Owner" : "Collaborator"}
                  </span>

                  <button
                    onClick={() => router.push(`/doc/${doc.id}`)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open sheet →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Delete Document?</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete this spreadsheet? This action is permanent and will delete all cell content for all collaborators.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
