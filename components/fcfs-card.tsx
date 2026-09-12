"use client";

import { useState, useMemo, useEffect } from "react";
import { problemStatements } from "../lib/problem-statements";

import { auth } from "../lib/firebase";

export function FCFSClaimCard({ initialClaimedPs }: { initialClaimedPs?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">(initialClaimedPs ? "success" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedPs, setSelectedPs] = useState<string | null>(initialClaimedPs || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // If successfully claimed, lock it down
  useEffect(() => {
    if (status === "success") {
      setIsDropdownOpen(false);
    }
  }, [status]);

  const filteredStatements = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return problemStatements.filter(
      (ps) =>
        ps.title.toLowerCase().includes(q) ||
        ps.ps_number.toLowerCase().includes(q) ||
        ps.category.toLowerCase().includes(q)
    ).slice(0, 50); // limit to 50 for performance
  }, [search]);

  const selectedData = useMemo(() => {
    return problemStatements.find((ps) => ps.ps_number === selectedPs);
  }, [selectedPs]);

  async function handleClaim() {
    if (!selectedPs) return;
    
    setLoading(true);
    setStatus("idle");
    setMessage(null);
    setShowConfirm(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch("/api/fcfs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ psNumber: selectedPs }),
      });

      const data = (await res.json()) as any;

      if (res.ok && data.success) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to claim problem statement.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold">Problem Statement</h2>
      </div>

      <div className="mt-4 border border-slate-200 p-4 space-y-4 text-sm bg-white">
        {status === "success" ? (
          <div className="space-y-3">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">PS Number</span>
              <span className="font-medium text-slate-900">{selectedData?.ps_number}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Category</span>
              <span className="font-medium text-slate-900">{selectedData?.category}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Title</span>
              <span className="font-medium text-slate-900 leading-relaxed">{selectedData?.title}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Only 2 teams can select a specific PS. You can only make 1 selection.
            </p>
            <div className="relative">
              <input
                type="text"
                placeholder="Search PS Number or Title..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsDropdownOpen(true);
                  if (selectedPs) {
                    setSelectedPs(null);
                    setShowConfirm(false);
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
              
              {isDropdownOpen && search && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-sm">
                  {filteredStatements.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500">No results found.</div>
                  ) : (
                    filteredStatements.map((ps) => (
                      <div
                        key={ps.ps_number}
                        onClick={() => {
                          setSelectedPs(ps.ps_number);
                          setSearch(`${ps.ps_number} - ${ps.title}`);
                          setIsDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <div className="font-medium text-slate-900 text-xs mb-1">
                          {ps.ps_number} <span className="text-slate-400 font-normal">({ps.category})</span>
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-1">{ps.title}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {showConfirm ? (
              <div className="p-3 bg-red-50 border border-red-200 mt-4">
                <p className="text-xs font-semibold text-red-800 mb-3">
                  ⚠️ WARNING: You will be unable to deselect or change this Problem Statement later. This action is final!
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClaim}
                    disabled={loading}
                    className="bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "Locking..." : "Confirm & Lock PS"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!selectedPs || loading}
                  className="border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Lock PS
                </button>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="text-xs font-medium text-red-600 mt-2">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
