import React, { useEffect, useMemo, useState } from "react";

const FIELDS = ["SUMMARY", "EDUCATION", "COMPETENCIES", "EXPERIENCE", "PROJECTS", "CERTS"];
const DEFAULT_BACKEND_URL = "http://localhost:4000";
const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Gemini 2.0" },
  { value: "anthropic", label: "Anthropic" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "xai", label: "xAI" }
];

const PRESET_MODELS = {
  openai: ["gpt-3.5-turbo"],
  ollama: ["llama3", "llama3.1", "deepseek"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro-free"],
  anthropic: ["claude-sonnet-4-20250514"],
  deepseek: ["deepseek-chat"],
  xai: ["grok-beta"]
};

const MODEL_CATALOG = {
  openai: [
    {
      id: "gpt-3.5-turbo",
      label: "GPT-3.5 Turbo",
      description: "OpenAI’s budget-friendly workhorse. Great quality at the lowest price tier."
    }
  ],
  ollama: [
    {
      id: "llama3",
      label: "Llama 3",
      description: "Meta’s flagship open model. Strong reasoning with affordable local inference.",
      notes: "Runs locally via Ollama. Ensure the model is pulled before generating."
    },
    {
      id: "llama3.1",
      label: "Llama 3.1",
      description: "Latest Llama iteration with improved instruction-following and formatting."
    },
    {
      id: "deepseek",
      label: "DeepSeek R1",
      description: "Reasoning-heavy model optimised for detailed bullet generation and summaries."
    }
  ],
  gemini: [
    {
      id: "gemini-2.0-flash",
      label: "Gemini 2.0 Flash",
      description: "Google's latest multi-modal model optimized for speed and efficiency."
    },
    {
      id: "gemini-1.5-flash",
      label: "Gemini 1.5 Flash (Free tier)",
      description: "Fast text model with generous free quota. Perfect for zero-cost generation.",
      notes: "Use a MakerSuite key; billed at $0 for light usage."
    },
    {
      id: "gemini-pro-free",
      label: "Gemini Pro (Legacy free tier)",
      description: "Balanced model available on the free Gemini plan for text-only workflows."
    }
  ],
  anthropic: [
    {
      id: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4.5",
      description: "Anthropic's advanced reasoning model with exceptional performance on complex tasks."
    }
  ],
  deepseek: [
    {
      id: "deepseek-chat",
      label: "DeepSeek R1 0528",
      description: "High-performance reasoning model optimized for detailed analysis and generation."
    }
  ],
  xai: [
    {
      id: "grok-beta",
      label: "Grok 4 Fast",
      description: "xAI's fast inference model designed for rapid response generation."
    }
  ]
};

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const backendUrl = DEFAULT_BACKEND_URL; // Fixed URL, not editable
  const [fixedFields, setFixedFields] = useState(null);
  const [showFixedInfo, setShowFixedInfo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState((PRESET_MODELS.openai || [])[0] || "");
  const [geminiApiKey, setGeminiApiKey] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("geminiApiKey") || ""
  );
  const format = "pdf";

  useEffect(() => {
    loadFixedFields();
  }, [backendUrl]);

  useEffect(() => {
    const presets = PRESET_MODELS[llmProvider];
    if (presets && presets.length > 0) {
      setLlmModel(presets[0]);
    } else {
      setLlmModel("");
    }
  }, [llmProvider]);

  useEffect(() => {
    if (llmProvider === "gemini" && typeof window !== "undefined") {
      window.localStorage.setItem("geminiApiKey", geminiApiKey);
    }
  }, [llmProvider, geminiApiKey]);

  const providerModelPresets = useMemo(() => PRESET_MODELS[llmProvider] || [], [llmProvider]);
  const activeModelMeta = useMemo(() => {
    return (MODEL_CATALOG[llmProvider] || []).find((entry) => entry.id === llmModel) || null;
  }, [llmProvider, llmModel]);

  function loadFixedFields() {
    fetch(`${backendUrl}/api/fixed-fields`)
      .then(async (res) => {
        if (!res.ok) {
          console.error(`Failed to load fixed fields: ${res.status} ${res.statusText}`);
          setFixedFields(null);
          return null;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response from fixed-fields:", text.substring(0, 200));
          setFixedFields(null);
          return null;
        }

        return res.json();
      })
      .then((data) => {
        if (data) {
          setFixedFields(data);
          if (data.source === "uploaded") {
            setUploadedFileName("Uploaded Resume");
          } else {
            setUploadedFileName(null);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading fixed fields:", err);
        setFixedFields(null);
      });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await fetch(`${backendUrl}/api/upload-resume`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } else {
            const text = await response.text();
            console.error("Non-JSON error response:", text.substring(0, 500));
            errorMsg = `Server returned non-JSON error. Status: ${response.status}. Check console for details.`;
          }
        } catch (parseErr) {
          console.error("Error parsing error response:", parseErr);
        }
        alert(errorMsg);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 500));
        alert(`Server error: Received non-JSON response. Is the backend server running at ${backendUrl}?`);
        return;
      }

      const result = await response.json();
      setUploadedFileName(file.name);

      const message = result.note
        ? `${result.message}\n\n${result.note}\n\nExtracted ${result.extractedFields?.length || 0} fields.\n\nClick "Fixed fields" to review the data.`
        : result.message || "Resume uploaded successfully! Fixed fields have been extracted.";
      alert(message);

      setTimeout(() => {
        loadFixedFields();
        if (!showFixedInfo) {
          setShowFixedInfo(true);
        }
      }, 400);
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Network error: ${err.message}. Ensure the backend is running at ${backendUrl}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleClearUploaded() {
    try {
      const response = await fetch(`${backendUrl}/api/clear-uploaded-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        alert("Server error: Received non-JSON response. Is the backend running?");
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        alert("Error: " + (result.error || "Failed to clear uploaded resume"));
        return;
      }

      setUploadedFileName(null);
      loadFixedFields();
      alert("Reverted to base resume data.");
    } catch (err) {
      console.error("Clear error:", err);
      alert(`Network error: ${err.message}. Ensure the backend is running at ${backendUrl}`);
    }
  }

  async function handleGenerateAll(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        description: text,
        llmProvider,
        llmModel: llmModel?.trim() || undefined
      };
      if (!payload.llmModel) delete payload.llmModel;
      if (llmProvider === "gemini" && geminiApiKey.trim()) {
        payload.geminiApiKey = geminiApiKey.trim();
      }

      const aiResponse = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let aiFields;
      try {
        const contentType = aiResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          aiFields = await aiResponse.json();
        } else {
          const text = await aiResponse.text();
          console.error("Non-JSON response from generate:", text.substring(0, 500));
          alert(`Server error: Received non-JSON response. Status: ${aiResponse.status}.`);
          return;
        }
      } catch (parseErr) {
        console.error("Error parsing JSON response:", parseErr);
        alert(`Error parsing server response. Make sure the backend is running at ${backendUrl}.`);
        return;
      }

      if (!aiResponse.ok || !aiFields || !aiFields.summary) {
        alert("Error: " + (aiFields?.error || "No content generated!"));
        return;
      }

      const replacements = {};
      for (const f of FIELDS) {
        if (aiFields[f.toLowerCase()]) {
          replacements[f] = aiFields[f.toLowerCase()];
        }
      }

      const response = await fetch(`${backendUrl}/api/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacements, format })
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          alert("Error: " + (err.error || JSON.stringify(err)));
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text.substring(0, 200));
          alert(`Server error: ${response.status} ${response.statusText}.`);
        }
        return;
      }

      if (!contentType || !contentType.includes("application/pdf")) {
        const text = await response.text();
        console.error("Expected PDF but got:", contentType, text.substring(0, 200));
        alert("Error: Server did not return a PDF file. Check backend logs.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <span className="floating-orb orb-1" />
      <span className="floating-orb orb-2" />
      <span className="floating-orb orb-3" />

      <header className="hero">
        <p className="hero-badge">Multi-model · Gemini 2.0 ready</p>
        <h1 className="hero-title">AI Resume Studio</h1>
        <p className="hero-subtitle">
          Upload your resume, drop a job description, and let the tailored PDF appear in seconds.
        </p>
      </header>

      <main className="content-grid">
        <section className="panel panel--primary" style={{ "--delay": "0s" }}>
          <div className="panel__header">
            <div className="panel__title-row">
              <h2 className="panel__title">1. Source resume & backend</h2>
              <button
                type="button"
                className={`icon-button ${showFixedInfo ? "is-active" : ""}`}
                onClick={() => setShowFixedInfo((prev) => !prev)}
                title="View fixed fields that never change"
                aria-label="View fixed fields"
              >
                ℹ
              </button>
            </div>
            <p className="panel__subtitle">
              Upload a PDF (optional) and connect to your running backend service.
            </p>
          </div>

          <div className="upload-zone">
            <label className={`upload-button ${uploading ? "is-busy" : ""}`}>
              {uploading ? (
                <>
                  <Spinner /> Uploading…
                </>
              ) : (
                <>
                  <span role="img" aria-label="upload">
                    📄
                  </span>{" "}
                  Upload resume PDF
                </>
              )}
              <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploading} hidden />
            </label>

            {uploadedFileName && (
              <div className="upload-status">
                <span className="upload-status__badge">✓ {uploadedFileName}</span>
                <button className="btn btn-ghost" type="button" onClick={handleClearUploaded}>
                  Remove file
                </button>
              </div>
            )}
          </div>

          <div className="panel__divider" />

          <div className="llm-inline">
            <div className="llm-inline__column">
              <span className="llm-inline__label">Provider</span>
              <select
                className="text-input select"
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="llm-inline__column">
              <span className="llm-inline__label">Model</span>
              <select className="text-input select" value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
                {providerModelPresets.map((model) => (
                  <option key={model} value={model}>
                    {MODEL_CATALOG[llmProvider]?.find((entry) => entry.id === model)?.label || model}
                  </option>
                ))}
                {!providerModelPresets.length && <option value="">(No presets)</option>}
              </select>
            </div>
            <div className="llm-inline__column llm-inline__column--meta">
              <p className="llm-inline__meta">
                {fixedFields?.source === "uploaded" ? "📄 Using uploaded resume data" : "📋 Using base resume"}
              </p>
              {uploadedFileName && (
                <p className="llm-inline__meta llm-inline__meta--secondary">Current PDF: {uploadedFileName}</p>
              )}
            </div>
          </div>

          {activeModelMeta && (
            <div className="model-info">
              <h3>{activeModelMeta.label}</h3>
              <p>{activeModelMeta.description}</p>
              {activeModelMeta.notes && <p className="model-info__notes">{activeModelMeta.notes}</p>}
            </div>
          )}

          <div className="meta-widget">
            <div>
              <span className="meta-widget__label">Resume source</span>
              <span className="meta-widget__value">
                {fixedFields?.source === "uploaded" ? "Uploaded PDF" : "Base resume"}
              </span>
            </div>
            <div>
              <span className="meta-widget__label">Upload status</span>
              <span className="meta-widget__value">
                {uploadedFileName ? `📄 ${uploadedFileName}` : "Using base template"}
              </span>
            </div>
          </div>

          {showFixedInfo && (
            <div className={`fixed-info ${showFixedInfo ? "is-open" : ""}`}>
              {!fixedFields && (
                <div className="fixed-info__empty">
                  ⚠️ Unable to load fixed fields. Ensure the backend server is reachable and try refreshing.
                </div>
              )}

              {fixedFields && (
                <div className="fixed-info__grid">
                  <div className="fixed-info__item">
                    <p className="fixed-info__heading">Name</p>
                    <p className="fixed-info__body">{fixedFields.name || "Not provided"}</p>
                  </div>
                  <div className="fixed-info__item">
                    <p className="fixed-info__heading">Contact</p>
                    <p className="fixed-info__body">
                      {fixedFields.email || "Not provided"} · {fixedFields.phone || "Not provided"}
                    </p>
                  </div>
                  <div className="fixed-info__item">
                    <p className="fixed-info__heading">LinkedIn</p>
                    <p className="fixed-info__body">{fixedFields.linkedin || "Not provided"}</p>
                  </div>
                  <div className="fixed-info__item">
                    <p className="fixed-info__heading">Portfolio</p>
                    <p className="fixed-info__body">{fixedFields.portfolio || "Not provided"}</p>
                  </div>
                  <div className="fixed-info__item fixed-info__wide">
                    <p className="fixed-info__heading">Education</p>
                    <pre className="fixed-info__body fixed-info__body--multiline">
                      {fixedFields.education || "Not provided"}
                    </pre>
                  </div>
                  <div className="fixed-info__item fixed-info__wide">
                    <p className="fixed-info__heading">Certificates · Patents</p>
                    <pre className="fixed-info__body fixed-info__body--multiline">
                      {fixedFields.certs || "Not provided"}
                    </pre>
                  </div>
                  {!!fixedFields.experienceTitles?.length && (
                    <div className="fixed-info__item fixed-info__wide">
                      <p className="fixed-info__heading">Experience titles</p>
                      <ul className="fixed-info__list">
                        {fixedFields.experienceTitles.map((title, idx) => (
                          <li key={idx}>{title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel panel--secondary" style={{ "--delay": "0.15s" }}>
          <div className="panel__header">
            <h2 className="panel__title">2. Paste job description</h2>
            <p className="panel__subtitle">
              The AI will keep your original details intact and tailor the variable sections.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleGenerateAll} autoComplete="off">
            <textarea
              className="text-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste the job description here."
              required
            />
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={loading || !text.trim()}>
                {loading ? (
                  <>
                    <Spinner /> Generating PDF…
                  </>
                ) : (
                  "Generate tailored PDF"
                )}
              </button>
            </div>
          </form>

          <div className="helper-text">
            Summary, competencies, experience content, and projects will be regenerated. Name, contact, education, and
            credentials stay untouched.
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Built with ❤️ &nbsp; <span>AI Resume Studio</span> · Need help? Review the included{" "}
          <a href="TEST_UPLOAD.md" target="_blank" rel="noreferrer">
            upload checklist
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function Spinner() {
  return <span className="spinner" />;
}