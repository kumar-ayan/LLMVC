"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o-mini");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setMaskedKey(data.apiKey || "");
        setHasKey(data.hasApiKey);
        setBaseUrl(data.baseUrl || "https://api.openai.com/v1");
        setModel(data.model || "gpt-4o-mini");
      });
  }, []);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { baseUrl, model };
      if (apiKey) body.apiKey = apiKey;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setMaskedKey(data.apiKey);
        setHasKey(data.hasApiKey);
        setApiKey("");
        showToast("success", "Settings saved!");
      } else {
        showToast("error", "Failed to save");
      }
    } catch {
      showToast("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Configure your LLM API for running evals
          </p>
        </div>
      </div>

      <div className="card settings-form">
        <div className="form-group">
          <label className="form-label">API Key</label>
          {hasKey && (
            <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
              Current key: {maskedKey}
            </p>
          )}
          <input
            type="password"
            className="input"
            placeholder={hasKey ? "Enter new key to update..." : "sk-..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Base URL</label>
          <input
            type="text"
            className="input"
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-sm text-muted mt-8">
            Use a custom endpoint for local models or alternative providers
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Model</label>
          <input
            type="text"
            className="input"
            placeholder="gpt-4o-mini"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "💾 Save Settings"}
        </button>
      </div>

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </>
  );
}
