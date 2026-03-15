"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Prompt {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  latest_version: number;
  version_count: number;
}

export default function DashboardPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [newPrompt, setNewPrompt] = useState({ name: "", description: "", content: "" });
  const [creating, setCreating] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      setPrompts(data);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleCreate = async () => {
    if (!newPrompt.name || !newPrompt.content) return;
    setCreating(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrompt),
      });
      if (res.ok) {
        setShowModal(false);
        setNewPrompt({ name: "", description: "", content: "" });
        fetchPrompts();
      }
    } catch (err) {
      console.error("Failed to create prompt:", err);
    } finally {
      setCreating(false);
    }
  };

  const filtered = prompts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Prompts</h1>
          <p className="page-subtitle">
            Manage, version, and evaluate your LLM prompts
          </p>
        </div>
        <div className="flex gap-12 items-center">
          <input
            type="text"
            className="input search-input"
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ＋ New Prompt
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Loading prompts...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">
            {search ? "No prompts found" : "No prompts yet"}
          </div>
          <div className="empty-state-text">
            {search
              ? "Try a different search term"
              : "Create your first prompt to get started with version control, diffing, and evals."}
          </div>
          {!search && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              ＋ Create First Prompt
            </button>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((prompt) => (
            <Link
              key={prompt.id}
              href={`/prompts/${prompt.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="card prompt-card">
                <div className="prompt-card-name">{prompt.name}</div>
                <div className="prompt-card-desc">
                  {prompt.description || "No description"}
                </div>
                <div className="prompt-card-meta">
                  <span className="badge">v{prompt.latest_version}</span>
                  <span className="badge">
                    {prompt.version_count} version{prompt.version_count !== 1 ? "s" : ""}
                  </span>
                  <span>{formatDate(prompt.updated_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Prompt</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Customer Support Bot"
                value={newPrompt.name}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, name: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="Brief description of what this prompt does"
                value={newPrompt.description}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, description: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prompt Content</label>
              <textarea
                className="textarea textarea-tall"
                placeholder="You are a helpful assistant that..."
                value={newPrompt.content}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, content: e.target.value })
                }
              />
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!newPrompt.name || !newPrompt.content || creating}
              >
                {creating ? "Creating..." : "Create Prompt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
