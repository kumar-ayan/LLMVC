"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Prompt {
  id: string;
  name: string;
  description: string;
  latest_version: number;
  version_count: number;
}

interface Version {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string;
  message: string;
  created_at: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumber?: { old?: number; new?: number };
}

interface DiffResult {
  v1: { version_number: number; message: string; created_at: string };
  v2: { version_number: number; message: string; created_at: string };
  diff: {
    lines: DiffLine[];
    stats: { additions: number; deletions: number; unchanged: number };
  };
}

interface TestCase {
  id: string;
  name: string;
  input: string;
  expected_output: string;
  created_at: string;
}

interface EvalRun {
  id: string;
  version_id: string;
  status: string;
  avg_score: number | null;
  created_at: string;
}

interface EvalResult {
  id: string;
  test_case_name: string;
  test_case_input: string;
  expected_output: string;
  output: string;
  score: number | null;
  judge_reasoning: string;
}

export default function PromptDetailPage() {
  const params = useParams();
  const promptId = params.id as string;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [activeTab, setActiveTab] = useState("editor");
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editorContent, setEditorContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  // Diff state
  const [diffV1, setDiffV1] = useState<number>(0);
  const [diffV2, setDiffV2] = useState<number>(0);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Test case state
  const [newTestCase, setNewTestCase] = useState({ name: "", input: "", expected_output: "" });
  const [addingTest, setAddingTest] = useState(false);

  // Eval state
  const [runningEval, setRunningEval] = useState(false);
  const [evalVersionId, setEvalVersionId] = useState("");
  const [selectedEvalRun, setSelectedEvalRun] = useState<EvalRun | null>(null);
  const [evalResults, setEvalResults] = useState<EvalResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}`);
      if (res.ok) {
        const data = await res.json();
        setPrompt(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [promptId]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/versions`);
      const data = await res.json();
      setVersions(data);
      if (data.length > 0 && !selectedVersion) {
        setSelectedVersion(data[0]);
        setEditorContent(data[0].content);
        setDiffV2(data[0].version_number);
        setDiffV1(data.length > 1 ? data[1].version_number : data[0].version_number);
        setEvalVersionId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [promptId, selectedVersion]);

  const fetchTestCases = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/test-cases`);
      const data = await res.json();
      setTestCases(data);
    } catch (err) {
      console.error(err);
    }
  }, [promptId]);

  const fetchEvalRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/evals`);
      const data = await res.json();
      setEvalRuns(data);
    } catch (err) {
      console.error(err);
    }
  }, [promptId]);

  useEffect(() => {
    Promise.all([fetchPrompt(), fetchVersions(), fetchTestCases(), fetchEvalRuns()]).then(() =>
      setLoading(false)
    );
  }, [fetchPrompt, fetchVersions, fetchTestCases, fetchEvalRuns]);

  const handleSaveVersion = async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editorContent,
          message: commitMessage || "Updated prompt",
        }),
      });
      if (res.ok) {
        setCommitMessage("");
        setSelectedVersion(null);
        await fetchVersions();
        await fetchPrompt();
        showToast("success", "Version saved!");
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save version");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectVersion = (v: Version) => {
    setSelectedVersion(v);
    setEditorContent(v.content);
  };

  const handleDiff = async () => {
    if (!diffV1 || !diffV2 || diffV1 === diffV2) return;
    setLoadingDiff(true);
    try {
      const res = await fetch(
        `/api/prompts/${promptId}/diff?v1=${diffV1}&v2=${diffV2}`
      );
      if (res.ok) {
        const data = await res.json();
        setDiffResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleAddTestCase = async () => {
    if (!newTestCase.name || !newTestCase.input) return;
    setAddingTest(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/test-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTestCase),
      });
      if (res.ok) {
        setNewTestCase({ name: "", input: "", expected_output: "" });
        fetchTestCases();
        showToast("success", "Test case added!");
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to add test case");
    } finally {
      setAddingTest(false);
    }
  };

  const handleDeleteTestCase = async (tcId: string) => {
    try {
      await fetch(`/api/prompts/${promptId}/test-cases/${tcId}`, {
        method: "DELETE",
      });
      fetchTestCases();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunEval = async () => {
    if (!evalVersionId) return;
    setRunningEval(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: evalVersionId }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchEvalRuns();
        handleViewEvalRun(data.id);
        showToast("success", "Eval completed!");
      } else {
        const err = await res.json();
        showToast("error", err.error || "Eval failed");
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to run eval");
    } finally {
      setRunningEval(false);
    }
  };

  const handleViewEvalRun = async (runId: string) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/evals/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEvalRun(data.run);
        setEvalResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    setRollingBack(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetVersion }),
      });
      if (res.ok) {
        setRollbackTarget(null);
        setSelectedVersion(null);
        await fetchVersions();
        await fetchPrompt();
        showToast("success", `Rolled back to v${targetVersion}`);
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Rollback failed");
    } finally {
      setRollingBack(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!confirm("Delete this prompt and all its versions? This cannot be undone.")) return;
    try {
      await fetch(`/api/prompts/${promptId}`, { method: "DELETE" });
      window.location.href = "/";
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreClass = (score: number | null) => {
    if (score === null) return "";
    if (score >= 7) return "score-high";
    if (score >= 4) return "score-mid";
    return "score-low";
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading prompt...</span>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Prompt not found</div>
        <Link href="/" className="btn btn-primary mt-16">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="back-link">
        ← Back to prompts
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{prompt.name}</h1>
          {prompt.description && (
            <p className="page-subtitle">{prompt.description}</p>
          )}
        </div>
        <div className="flex gap-8">
          <button className="btn btn-danger btn-sm" onClick={handleDeletePrompt}>
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {["editor", "versions", "diff", "test-cases", "evals"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "editor"
              ? "✏️ Editor"
              : tab === "versions"
              ? "📋 Versions"
              : tab === "diff"
              ? "🔀 Diff"
              : tab === "test-cases"
              ? "🧪 Test Cases"
              : "📊 Evals"}
          </button>
        ))}
      </div>

      {/* EDITOR TAB */}
      {activeTab === "editor" && (
        <div className="split-layout">
          <div>
            <div className="card">
              <div className="form-group">
                <label className="form-label">
                  Prompt Content{" "}
                  {selectedVersion && (
                    <span style={{ color: "var(--accent-primary)", fontWeight: 400 }}>
                      (editing v{selectedVersion.version_number})
                    </span>
                  )}
                </label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 340 }}
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="You are a helpful assistant that..."
                />
              </div>
              <div className="flex gap-12 items-center">
                <input
                  type="text"
                  className="input"
                  placeholder="Commit message (optional)"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveVersion}
                  disabled={saving || !editorContent.trim()}
                >
                  {saving ? "Saving..." : "💾 Save Version"}
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className="card" style={{ maxHeight: 500, overflowY: "auto" }}>
              <label className="form-label mb-16">Recent Versions</label>
              {versions.length === 0 ? (
                <p className="text-muted text-sm">No versions yet</p>
              ) : (
                <div className="timeline">
                  {versions.slice(0, 10).map((v) => (
                    <div
                      key={v.id}
                      className={`timeline-item ${
                        selectedVersion?.id === v.id ? "active" : ""
                      }`}
                      onClick={() => handleSelectVersion(v)}
                    >
                      <div className="timeline-version">
                        <span className="timeline-version-number">
                          v{v.version_number}
                        </span>
                        <span className="timeline-version-date">
                          {formatDate(v.created_at)}
                        </span>
                      </div>
                      <div className="timeline-message">
                        {v.message || "No message"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VERSIONS TAB */}
      {activeTab === "versions" && (
        <div className="card">
          <label className="form-label mb-16">
            All Versions ({versions.length})
          </label>
          {versions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No versions</div>
            </div>
          ) : (
            <div className="timeline">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`timeline-item ${
                    selectedVersion?.id === v.id ? "active" : ""
                  }`}
                  onClick={() => {
                    handleSelectVersion(v);
                    setActiveTab("editor");
                  }}
                >
                  <div className="timeline-version">
                    <span className="timeline-version-number">
                      v{v.version_number}
                    </span>
                    <span className="timeline-version-date">
                      {formatDate(v.created_at)}
                    </span>
                  </div>
                  <div className="timeline-message">
                    {v.message || "No message"}
                  </div>
                  {v.version_number < (prompt?.latest_version || 0) && (
                    <div style={{ marginTop: 8 }}>
                      {rollbackTarget === v.version_number ? (
                        <div className="rollback-bar">
                          <span>Rollback to v{v.version_number}?</span>
                          <div className="flex gap-8">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRollbackTarget(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={rollingBack}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRollback(v.version_number);
                              }}
                            >
                              {rollingBack ? "..." : "Confirm"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRollbackTarget(v.version_number);
                          }}
                        >
                          ↩ Rollback here
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIFF TAB */}
      {activeTab === "diff" && (
        <div className="card">
          <div className="diff-selector mb-16">
            <span className="diff-selector-label">Compare</span>
            <select
              className="select"
              value={diffV1}
              onChange={(e) => setDiffV1(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  v{v.version_number} — {v.message || "No message"}
                </option>
              ))}
            </select>
            <span className="diff-selector-label">→</span>
            <select
              className="select"
              value={diffV2}
              onChange={(e) => setDiffV2(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  v{v.version_number} — {v.message || "No message"}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDiff}
              disabled={loadingDiff || diffV1 === diffV2}
            >
              {loadingDiff ? "Computing..." : "Compare"}
            </button>
          </div>

          {diffResult && (
            <div className="diff-container">
              <div className="diff-header">
                <span>
                  v{diffResult.v1.version_number} → v{diffResult.v2.version_number}
                </span>
                <div className="diff-stats">
                  <span className="added">
                    +{diffResult.diff.stats.additions}
                  </span>
                  <span className="removed">
                    −{diffResult.diff.stats.deletions}
                  </span>
                </div>
              </div>
              {diffResult.diff.lines.map((line, i) => (
                <div key={i} className={`diff-line ${line.type}`}>
                  <span className="diff-line-number">
                    {line.lineNumber?.old || ""}
                  </span>
                  <span className="diff-line-number">
                    {line.lineNumber?.new || ""}
                  </span>
                  <span className="diff-line-prefix">
                    {line.type === "added"
                      ? "+"
                      : line.type === "removed"
                      ? "−"
                      : " "}
                  </span>
                  <span className="diff-line-content">{line.value}</span>
                </div>
              ))}
            </div>
          )}

          {!diffResult && !loadingDiff && (
            <div className="empty-state">
              <div className="empty-state-icon">🔀</div>
              <div className="empty-state-title">Select versions to compare</div>
              <div className="empty-state-text">
                Pick two different versions above and click Compare
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEST CASES TAB */}
      {activeTab === "test-cases" && (
        <div>
          <div className="card mb-16">
            <label className="form-label mb-16">Add Test Case</label>
            <div className="form-group">
              <input
                type="text"
                className="input"
                placeholder="Test case name"
                value={newTestCase.name}
                onChange={(e) =>
                  setNewTestCase({ ...newTestCase, name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">User Input</label>
              <textarea
                className="textarea"
                placeholder="The user input to test with..."
                value={newTestCase.input}
                onChange={(e) =>
                  setNewTestCase({ ...newTestCase, input: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Output (optional)</label>
              <textarea
                className="textarea"
                placeholder="The expected ideal response..."
                value={newTestCase.expected_output}
                onChange={(e) =>
                  setNewTestCase({
                    ...newTestCase,
                    expected_output: e.target.value,
                  })
                }
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAddTestCase}
              disabled={addingTest || !newTestCase.name || !newTestCase.input}
            >
              {addingTest ? "Adding..." : "➕ Add Test Case"}
            </button>
          </div>

          {testCases.length > 0 && (
            <div className="card">
              <label className="form-label mb-16">
                Test Cases ({testCases.length})
              </label>
              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <strong style={{ fontSize: 14 }}>{tc.name}</strong>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteTestCase(tc.id)}
                      style={{ color: "var(--accent-danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    className="text-sm text-muted mt-8 font-mono"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    <strong>Input:</strong> {tc.input.slice(0, 150)}
                    {tc.input.length > 150 && "..."}
                  </div>
                  {tc.expected_output && (
                    <div
                      className="text-sm text-muted mt-8 font-mono"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      <strong>Expected:</strong>{" "}
                      {tc.expected_output.slice(0, 150)}
                      {tc.expected_output.length > 150 && "..."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EVALS TAB */}
      {activeTab === "evals" && (
        <div>
          <div className="card mb-16">
            <label className="form-label mb-16">Run Evaluation</label>
            <div className="flex gap-12 items-center">
              <select
                className="select"
                value={evalVersionId}
                onChange={(e) => setEvalVersionId(e.target.value)}
                style={{ flex: 1 }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} — {v.message || "No message"}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleRunEval}
                disabled={runningEval || !evalVersionId || testCases.length === 0}
              >
                {runningEval ? "Running..." : "▶ Run Eval"}
              </button>
            </div>
            {testCases.length === 0 && (
              <p className="text-sm text-muted mt-8">
                Add test cases first before running evals.
              </p>
            )}
          </div>

          {/* Eval runs list */}
          {evalRuns.length > 0 && (
            <div className="card mb-16">
              <label className="form-label mb-16">
                Eval History ({evalRuns.length})
              </label>
              {evalRuns.map((run) => {
                const v = versions.find((vv) => vv.id === run.version_id);
                return (
                  <div
                    key={run.id}
                    onClick={() => handleViewEvalRun(run.id)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      borderRadius: "var(--radius-sm)",
                      background:
                        selectedEvalRun?.id === run.id
                          ? "var(--bg-hover)"
                          : "transparent",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-8">
                        <span
                          className={`status-dot ${run.status}`}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          {v ? `v${v.version_number}` : "?"} eval
                        </span>
                      </div>
                      <div className="flex items-center gap-12">
                        {run.avg_score !== null && (
                          <span
                            className={`score-badge ${getScoreClass(
                              run.avg_score
                            )}`}
                          >
                            {run.avg_score.toFixed(1)}
                          </span>
                        )}
                        <span className="text-sm text-muted">
                          {formatDate(run.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Eval results */}
          {loadingResults && (
            <div className="loading-overlay">
              <div className="spinner" />
            </div>
          )}

          {selectedEvalRun && evalResults.length > 0 && !loadingResults && (
            <div className="card">
              <div className="flex justify-between items-center mb-16">
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Results — Avg Score:{" "}
                  <span
                    className={`score-badge ${getScoreClass(
                      selectedEvalRun.avg_score
                    )}`}
                  >
                    {selectedEvalRun.avg_score?.toFixed(1) ?? "N/A"}
                  </span>
                </label>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="eval-table">
                  <thead>
                    <tr>
                      <th>Test Case</th>
                      <th>Score</th>
                      <th>Output</th>
                      <th>Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalResults.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.test_case_name}</strong>
                          <div
                            className="text-sm text-muted font-mono mt-8"
                            style={{
                              maxWidth: 200,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {r.test_case_input?.slice(0, 100)}
                            {(r.test_case_input?.length || 0) > 100 && "..."}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`score-badge ${getScoreClass(r.score)}`}
                          >
                            {r.score !== null ? r.score.toFixed(1) : "—"}
                          </span>
                        </td>
                        <td>
                          <div
                            className="font-mono text-sm"
                            style={{
                              maxWidth: 300,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {r.output?.slice(0, 200)}
                            {(r.output?.length || 0) > 200 && "..."}
                          </div>
                        </td>
                        <td>
                          <div
                            className="text-sm"
                            style={{ maxWidth: 250, wordBreak: "break-word" }}
                          >
                            {r.judge_reasoning}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </>
  );
}
