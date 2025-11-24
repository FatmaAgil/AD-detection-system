import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import UniversalSymptomForm from "./UniversalSymptomForm";

export default function AdScan() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [images, setImages] = useState([]);
  const [results, setResults] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState(null);

  // NEW: Model selection state
  const [selectedModel, setSelectedModel] = useState('light'); // 'light' or 'dark'

  // (chat removed) -- symptom form / results used instead
  // chat-related state and refs removed; UI now uses UniversalSymptomForm

  // keep a list of created preview URLs so we revoke only what we created
  const previewsRef = useRef([]);

  // revoke all previews on component unmount only
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      previewsRef.current = [];
    };
  }, []);

  // live risk estimate from backend (0..1)
  const [riskEstimate, setRiskEstimate] = useState(null);

  // universal assessment report (from UniversalSymptomForm) and handler
  const [universalReport, setUniversalReport] = useState(null);
  const handleAssessmentSubmit = (report) => {
    // symptom confidence from form/report (0..1)
    const symptomConf = Number(report?.final_confidence) || 0;

    // compute scan (AI) confidence from current results (average prediction.score), but only if classified as AD
    let scanConf = 0;
    let hasAdClassification = false;
    if (results && results.length > 0) {
      const adScores = results
        .filter((r) => r?.prediction?.label === "ad")  // only include if labeled as AD
        .map((r) => Number(r?.prediction?.score) || 0);
      if (adScores.length > 0) {
        scanConf = adScores.reduce((a, b) => a + b, 0) / adScores.length;
        hasAdClassification = true;
      }
      // If no AD classifications, scanConf remains 0
    }

    // weights: clinician => symptom heavier (0.6 symptom / 0.4 ai), patient => ai heavier (0.6 ai / 0.4 symptom)
    const userTypeForWeight = report?.user_type || "patient";
    const aiWeight = userTypeForWeight === "clinician" ? 0.4 : 0.6;
    const symWeight = userTypeForWeight === "clinician" ? 0.6 : 0.4;

    // final risk: only combine if there's AI evidence for AD; otherwise, base on symptoms alone (scaled down)
    const finalRisk = hasAdClassification
      ? Math.min(1, Math.max(0, aiWeight * scanConf + symWeight * symptomConf))
      : Math.min(1, Math.max(0, symWeight * symptomConf * 0.5));  // reduce symptom-only risk

    // update UI state
    setRiskEstimate(finalRisk);
    setUniversalReport({
      ...report,
      combined: {
        scan_confidence: scanConf,
        symptom_confidence: symptomConf,
        has_ad_classification: hasAdClassification,
        final_combined: finalRisk,
      },
    });
  };

  const [errors, setErrors] = useState([]); // validation errors
  const [analyzing, setAnalyzing] = useState(false); // scan in progress
  const [saving, setSaving] = useState(false); // save in progress

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const revokePreview = (url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };

  const clearAllPreviews = () => {
    previewsRef.current.forEach(revokePreview);
    previewsRef.current = [];
    setImages([]);
  };

  // chat/history helpers removed - using symptom form and result saving elsewhere

  // DROPZONE: handle dropped / selected files
  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      const newErrors = [];

      // handle rejected files (react-dropzone provides reasons)
      fileRejections.forEach((rej) => {
        rej.errors.forEach((err) => {
          if (err.code === "file-invalid-type") {
            newErrors.push(`${rej.file.name}: invalid file type`);
          } else if (err.code === "file-too-large") {
            newErrors.push(`${rej.file.name}: file is too large (max 5MB)`);
          } else {
            newErrors.push(`${rej.file.name}: ${err.message}`);
          }
        });
      });

      // additionally validate size and type for acceptedFiles (defensive)
      const validated = [];

      acceptedFiles.forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
          newErrors.push(`${file.name}: file is too large (max 5MB)`);
          return;
        }
        const t = file.type.toLowerCase();
        if (!(t === "image/jpeg" || t === "image/png" || t === "image/jpg")) {
          newErrors.push(`${file.name}: unsupported image format`);
          return;
        }
        // create a stable preview URL and remember it for cleanup
        const url = URL.createObjectURL(file);
        previewsRef.current.push(url);
        validated.push(
          Object.assign(file, {
            preview: url,
          })
        );
      });

      // Append to existing images, limit to 10 total
      setImages((prev) => {
        const combined = [...prev, ...validated].slice(0, 10);
        return combined;
      });

      if (newErrors.length > 0) setErrors((prev) => [...prev, ...newErrors]);
    },
    [MAX_FILE_SIZE]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    noClick: true, // we'll provide our own buttons
    noKeyboard: true,
  });

  // Remove an image before scanning
  const removeImage = (index) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed && removed.preview) {
        // revoke the single preview and remove it from our previewsRef list
        revokePreview(removed.preview);
        previewsRef.current = previewsRef.current.filter((u) => u !== removed.preview);
      }
      return next;
    });
  };

  // UPDATED: handle scanning with model selection
  const handleScan = async () => {
    if (images.length === 0) return;
    setErrors([]);
    setAnalyzing(true);
    setResults([]);

    try {
      const formData = new FormData();
      images.forEach((file) => formData.append("images", file, file.name));
      
      // NEW: Add model selection to form data
      formData.append("model_type", selectedModel);

      const res = await fetch("http://localhost:8000/api/adscan/upload/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          // Do NOT set Content-Type for FormData
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // server returns { results: [...], errors: [...] } (errors may be present)
        setResults(data.results || []);
        
        // Server may return which model was used
        if (data.model_used) {
          console.log(`Analysis completed using ${data.model_used}`);
        }
        
        if (data.errors && data.errors.length > 0) {
          const msgs = data.errors.map((e) => {
            const idx = e.index != null ? `#${e.index}` : "";
            const name = e.filename ? `(${e.filename})` : "";
            // prefer readable detail if available
            let detail = "";
            if (e.details) {
              try {
                detail = typeof e.details === "string" ? e.details : JSON.stringify(e.details);
              } catch {
                detail = String(e.details);
              }
            }
            return `Image ${idx} ${name}: ${e.error}${detail ? " - " + detail : ""}`;
          });
          setErrors((prev) => [...prev, ...msgs]);
          alert("Some images failed:\n" + msgs.join("\n"));
        } else {
          const modelName = selectedModel === 'light' ? 'General Model' : 'Dark Skin Optimized Model';
          alert(`Images analyzed successfully using ${modelName}!`);
        }
      } else {
        // non-OK response
        const msg = data.error || data.detail || "Upload failed.";
        setErrors((prev) => [...prev, msg]);
        alert(msg);
      }
    } catch (err) {
      setErrors((prev) => [...prev, err.message || "Network error"]);
      alert("Network error while uploading images.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Save current scan (results + report + estimate) to backend
  const handleSaveScan = async () => {
    // nothing to save
    if (!results || results.length === 0) {
      alert("No scan results to save.");
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const payload = {
        results,
        universal_report: universalReport,
        risk_estimate: riskEstimate,
        model_used: selectedModel,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch("http://localhost:8000/api/adscan/save/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.message || "Scan saved successfully.");
      } else {
        const msg = data.error || data.detail || "Failed to save scan.";
        setErrors((prev) => [...prev, msg]);
        alert(msg);
      }
    } catch (err) {
      setErrors((prev) => [...prev, err.message || "Network error"]);
      alert("Network error while saving scan.");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (src) => {
    if (!src) return;
    setModalSrc(src);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalSrc(null);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    // prevent background scroll when modal open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  // Section 1: Upload Images with Model Selection
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #e3f0ff 0%, #f9fbfd 100%)" }}>
      <UserSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <UserNavbar sidebarWidth={sidebarWidth} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 90,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        {/* Section 1: Upload Images */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(33,150,243,0.08)",
            padding: 32,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 18 }}>1. Upload Images</h2>

          {/* NEW: Model Selection UI */}
          <div style={{ marginBottom: 20, padding: 16, background: "#f8fafc", borderRadius: 12 }}>
            <h3 style={{ color: "#334155", marginBottom: 12, fontSize: 16 }}>Select Analysis Model:</h3>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="modelType"
                  value="light"
                  checked={selectedModel === 'light'}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600, color: selectedModel === 'light' ? "#1e90e8" : "#64748b" }}>
                  General Model
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
                  (Optimized for lighter skin tones)
                </span>
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="modelType"
                  value="dark"
                  checked={selectedModel === 'dark'}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600, color: selectedModel === 'dark' ? "#1e90e8" : "#64748b" }}>
                  Dark Skin Optimized
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
                  (Specialized for darker skin tones)
                </span>
              </label>
            </div>
            
            {/* Disclaimer */}
            <div style={{ marginTop: 12, padding: 12, background: "#fff3cd", borderRadius: 8, border: "1px solid #ffeaa7" }}>
              <div style={{ fontSize: 13, color: "#856404", fontWeight: 600 }}>
                ⚠️ Model Selection Guide:
              </div>
              <div style={{ fontSize: 12, color: "#856404", marginTop: 4 }}>
                • <strong>General Model</strong>: Best for lighter skin tones. Higher accuracy on training data.
                <br />
                • <strong>Dark Skin Optimized</strong>: Specialized for darker skin tones where AD appears differently.
                <br />
                • Current selection: <strong>{selectedModel === 'light' ? 'General Model' : 'Dark Skin Optimized Model'}</strong>
              </div>
            </div>
          </div>

          <div
            {...getRootProps()}
            style={{
              border: "2px dashed #e6eef9",
              background: isDragActive ? "#f0f8ff" : "#fbfdff",
              padding: 20,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
            aria-disabled={analyzing}
          >
            <input {...getInputProps()} />
            <div style={{ fontSize: 15, color: "#0b6fbf" }}>
              {isDragActive ? "Drop the images here..." : "Drag & drop images here"}
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>or</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={open}
                disabled={analyzing}
                style={{
                  background: "#1e90e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Choose Files
              </button>
              <button
                onClick={() => {
                  clearAllPreviews();
                  setErrors([]);
                }}
                disabled={analyzing || images.length === 0}
                style={{
                  background: "#f3f4f6",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: images.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Accepted: .jpg, .jpeg, .png — Max 5MB each — Up to 10 files</div>
          </div>

          {/* errors */}
          {errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {errors.map((e, idx) => (
                <div key={idx} style={{ color: "#b91c1c", fontSize: 13 }}>
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* previews */}
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              {images.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 110,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    background: "#fff",
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    border: "1px solid #eef2f7",
                  }}
                >
                  <div style={{ position: "relative", width: 80, height: 80 }}>
                    {/* index badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: -10,
                        left: -10,
                        background: "#1e90e8",
                        color: "#fff",
                        fontSize: 12,
                        padding: "3px 7px",
                        borderRadius: 14,
                        fontWeight: 700,
                        zIndex: 20,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                      }}
                      aria-hidden="true"
                    >
                      #{idx + 1}
                    </span>

                    <img
                      src={img.preview}
                      alt={`upload-${idx + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      title={`Remove image #${idx + 1}`}
                      aria-label={`Remove image ${idx + 1}`}
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        background: "#fff",
                        borderRadius: "50%",
                        border: "1px solid #e5e7eb",
                        width: 22,
                        height: 22,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontWeight: 700,
                        color: "#d11f1f",
                        zIndex: 30,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#334155",
                      textAlign: "center",
                      maxWidth: 100,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={img.name}
                  >
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scan button */}
          <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
            {images.length > 0 && (
              <button
                onClick={handleScan}
                disabled={analyzing}
                style={{
                  background: analyzing ? "#94c6ff" : "#1e90e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: analyzing ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {analyzing ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.6)",
                        borderTop: "2px solid #fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Analyzing...
                  </>
                ) : (
                  "Scan Images"
                )}
              </button>
            )}

            {/* (history/chat controls removed) */}
           </div>

          {/* inline spinner keyframes */}
          <style>
            {`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}
          </style>
        </div>

        {/* Section 2: Result Section - show model results */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#f7fafd",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
            padding: 32,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>2. Scan Result</h2>

          {results.length === 0 ? (
            <div style={{ fontSize: 17, color: "#64748b" }}>No scans yet. Upload images to analyze.</div>
          ) : (
            <>
              {/* UPDATED: Summary line with model info */}
              {(() => {
                const adCount = results.reduce((acc, r) => acc + (r?.prediction?.label === "ad" ? 1 : 0), 0);
                const modelUsed = results[0]?.prediction?.model_used || (selectedModel === 'light' ? 'General Model' : 'Dark Skin Optimized Model');
                
                return (
                  <div style={{ marginBottom: 10, fontSize: 15, color: "#0f172a", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🩺</span>
                      <strong style={{ color: "#0f172a" }}>
                        {adCount} of {results.length} uploaded image{results.length > 1 ? "s" : ""} show{results.length > 1 ? "" : "s"} signs of Atopic Dermatitis.
                      </strong>
                    </div>
                    <div style={{ fontSize: 14, color: "#64748b", background: "#f1f5f9", padding: 8, borderRadius: 6 }}>
                      📊 Analysis performed using: <strong>{modelUsed}</strong>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {results.map((r, i) => {
                  // Prefer server-provided index (1-based) to find the correct image,
                  // fall back to result index if none provided.
                  const imgIndex = r.index != null ? r.index - 1 : i;
                  const localImg = images[imgIndex]?.preview || r.uploaded?.image || null;
                  const label = (r?.prediction?.label || "unknown").toLowerCase();
                  const isAd = label === "ad";
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "#fff",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #eef2f7",
                        cursor: "default",
                      }}
                    >
                      {localImg ? (
                        <button
                          onClick={() => openModal(localImg)}
                          style={{
                            border: "none",
                            padding: 0,
                            background: "transparent",
                            cursor: "pointer",
                            display: "inline-block",
                          }}
                          aria-label={`Open preview for image ${i + 1}`}
                        >
                          <img
                            src={localImg}
                            alt={`res-${i}`}
                            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }}
                          />
                        </button>
                      ) : (
                        <div style={{ width: 80, height: 80, borderRadius: 8, background: "#f1f5f9" }} />
                      )}

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: isAd ? "#d9534f" : "#2f855a", textTransform: "uppercase" }}>
                            {r?.prediction?.label || "UNKNOWN"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Confidence: {r?.prediction?.score != null ? `${(r.prediction.score * 100).toFixed(1)}%` : "n/a"}
                          </div>
                        </div>
                        {r?.notes && <div style={{ marginTop: 6, color: "#475569" }}>{r.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {/* Modal / Lightbox for full-size preview */}
          {modalOpen && modalSrc && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.6)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
              }}
              onClick={closeModal}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  background: "#fff",
                  borderRadius: 12,
                  padding: 12,
                  boxShadow: "0 8px 40px rgba(2,6,23,0.4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={closeModal}
                    aria-label="Close preview"
                    style={{
                      border: "none",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 6,
                      borderRadius: 6,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <img
                    src={modalSrc}
                    alt="full-preview"
                    style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Symptom Assessment (replaces chat) */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 6 }}>3. Symptom Assessment</h2>

          <UniversalSymptomForm
            scanResults={results}
            userType={"patient"}
            modelUsed={
              results && results.length > 0
                ? results[0]?.prediction?.model_used || (selectedModel === 'light' ? 'General Model' : 'Dark Skin Optimized Model')
                : selectedModel === 'light'
                ? 'General Model'
                : 'Dark Skin Optimized Model'
            }
            onFormSubmit={handleAssessmentSubmit}
          />

          {universalReport && (
            <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>{universalReport.title || "Assessment summary"}</div>
              <div style={{ color: "#334155", marginTop: 6 }}>{universalReport.summary || ""}</div>
              <div style={{ marginTop: 8 }}>
                Symptom confidence: <strong>{Math.round((universalReport.combined?.symptom_confidence || 0) * 100)}%</strong>
                <br />
                Scan (AI) confidence: <strong>{Math.round((universalReport.combined?.scan_confidence || 0) * 100)}%</strong>
                <br />
                Final combined confidence: <strong>{Math.round((universalReport.combined?.final_combined || 0) * 100)}%</strong>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Final Result */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#f7fafd",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
            padding: 32,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>4. Final Result</h2>
          <div style={{ fontSize: 17, color: "#64748b" }}>
            {riskEstimate != null ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  Estimated AD probability: <strong>{(riskEstimate * 100).toFixed(0)}%</strong>
                </div>
                <div style={{ background: "#e6eef9", borderRadius: 8, height: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.round(riskEstimate * 100)}%`,
                      height: "100%",
                      background: riskEstimate >= 0.5 ? "#d9534f" : "#2f855a",
                      transition: "width 300ms ease",
                    }}
                  />
                </div>
                <div style={{ marginTop: 8, color: "#334155", fontSize: 14 }}>
                  This estimate combines the image analysis and symptom answers. It is not a diagnosis — consult a clinician for confirmation.
                </div>
                {/* Save Scan button */}
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={handleSaveScan}
                    disabled={saving || analyzing}
                    style={{
                      background: saving ? "#94c6ff" : "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      cursor: saving || analyzing ? "not-allowed" : "pointer",
                      fontWeight: "600",
                    }}
                  >
                    {saving ? "Saving..." : "Save Scan"}
                  </button>
                </div>
              </>
            ) : (
              <div>Final AD scan result: No suspicious activity detected.</div>
            )}
          </div>
        </div>

        {/* Section 5: Recommendation Section */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
            padding: 24,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>5. Recommendations</h2>
          {universalReport ? (
            <>
              {Array.isArray(universalReport.recommendations) && universalReport.recommendations.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Recommendations</div>
                  <ul style={{ paddingLeft: 20, color: "#374151" }}>
                    {universalReport.recommendations.map((rec, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(universalReport.next_steps) && universalReport.next_steps.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Next Steps</div>
                  <ul style={{ paddingLeft: 20, color: "#374151" }}>
                    {universalReport.next_steps.map((step, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                // If there are no recommendations/next steps, show a small hint
                ( !(Array.isArray(universalReport.recommendations) && universalReport.recommendations.length > 0) ) && (
                  <div style={{ color: "#64748b" }}>Complete an assessment to view personalized recommendations.</div>
                )
              )}
            </>
          ) : (
            <div style={{ color: "#64748b" }}>Complete an assessment to view personalized recommendations.</div>
          )}
        </div>
      </div>
    </div>
  );
}