import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import { saveChat } from "../utils/chatStorage"; // added import

export default function AdScan() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [images, setImages] = useState([]);
  const [results, setResults] = useState([]); // <-- new
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState(null);

  // Chat state (Step 3)
  const [chatMessages, setChatMessages] = useState([
    // optionally seed with a welcome message
    { sender: "ai", text: "Hi — ask me about the scan results or upload more images." },
  ]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const [errors, setErrors] = useState([]); // validation errors
  const [analyzing, setAnalyzing] = useState(false); // scan in progress

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // build chat object from current state
  const buildChatObject = () => {
    const date = new Date().toISOString();
    const messages = [];

    messages.push({
      sender: "user",
      text: `Uploaded ${images.length} image(s): ${images.map((f) => f.name).join(", ") || "none"}`,
    });

    messages.push({
      sender: "ai",
      text: "Analyzed images and returned predictions.",
    });

    results.forEach((r, i) => {
      const label = r?.prediction?.label || "unknown";
      const score = r?.prediction?.score != null ? `${(r.prediction.score * 100).toFixed(1)}%` : "n/a";
      messages.push({
        sender: "ai",
        text: `Image ${i + 1}: ${label} (confidence ${score})`,
      });
    });

    return {
      id: Date.now(),
      date,
      messages,
      images: images.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };
  };

  const handleSaveToHistory = () => {
    const chat = buildChatObject();
    const ok = saveChat(chat);
    if (ok) {
      alert("Saved scan to chat history.");
    } else {
      alert("Failed to save chat.");
    }
  };

  const handleNewChat = () => {
    if (images.length === 0 && results.length === 0) return;
    const shouldSave = window.confirm("Save current scan to history before starting a new chat?");
    if (shouldSave) handleSaveToHistory();
    // clear state
    setImages([]);
    setResults([]);
    setErrors([]);
  };

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
        validated.push(
          Object.assign(file, {
            preview: URL.createObjectURL(file),
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
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, [images]);

  // auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // handle scanning (previously handleImageUpload)
  const handleScan = async () => {
    if (images.length === 0) return;
    setErrors([]);
    setAnalyzing(true);
    setResults([]);

    try {
      const formData = new FormData();
      images.forEach((file) => formData.append("images", file, file.name));

      const res = await fetch("http://localhost:8000/api/adscan/upload/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          // Do NOT set Content-Type for FormData
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        alert("Images uploaded and analyzed successfully!");
      } else {
        const error = await res.json().catch(() => ({}));
        const msg = error.error || error.detail || "Upload failed.";
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

  // send chat message to backend
  const sendMessage = async () => {
    const trimmed = userInput.trim();
    if (!trimmed) return;
    // show user's message immediately
    const userMsg = { sender: "user", text: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    setUserInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/adscan/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          user_input: trimmed,
          previous_state: chatMessages,
          model_result: results,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiReply = data.reply || "No reply from server.";
        setChatMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail || err.error || "Server error";
        setChatMessages((prev) => [...prev, { sender: "ai", text: `Error: ${msg}` }]);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: "ai", text: `Network error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
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

  // Section 1: Upload Images (replaced UI)
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
                  setImages([]);
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
                    <img
                      src={img.preview || URL.createObjectURL(img)}
                      alt={`upload-${idx}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      title="Remove"
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
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "#334155", textAlign: "center", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
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

            <button
              onClick={handleSaveToHistory}
              style={{
                background: "#f3f4f6",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Save to History
            </button>
            <button
              onClick={handleNewChat}
              style={{
                background: "#f3f4f6",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              New Chat
            </button>
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
              {/* Summary line */}
              {(() => {
                const adCount = results.reduce((acc, r) => acc + (r?.prediction?.label === "ad" ? 1 : 0), 0);
                return (
                  <div style={{ marginBottom: 10, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🩺</span>
                    <strong style={{ color: "#0f172a" }}>
                      {adCount} of {results.length} uploaded image{results.length > 1 ? "s" : ""} show{results.length > 1 ? "" : "s"} signs of Atopic Dermatitis.
                    </strong>
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {results.map((r, i) => {
                  const localImg = images[i] ? images[i].preview || (images[i] && URL.createObjectURL(images[i])) : r.uploaded?.image || null;
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

        {/* Section 3: Interactive Chat */}
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
          <h2 style={{ color: "#1e90e8", marginBottom: 6 }}>3. AI Chat</h2>

          <div
            ref={chatRef}
            style={{
              height: 260,
              overflowY: "auto",
              padding: 12,
              borderRadius: 8,
              background: "#f8fafc",
              border: "1px solid #eef2f7",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {chatMessages.map((m, idx) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "78%",
                      background: isUser ? "#d1fae5" : "#e7f4ff",
                      color: "#0f172a",
                      padding: "8px 12px",
                      borderRadius: 12,
                      borderTopLeftRadius: isUser ? 12 : 4,
                      borderTopRightRadius: isUser ? 4 : 12,
                      boxShadow: "0 1px 2px rgba(2,6,23,0.04)",
                      fontSize: 15,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI about the scan results..."
              disabled={loading}
              rows={2}
              style={{
                flex: 1,
                resize: "none",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e6eef9",
                fontSize: 14,
                background: loading ? "#f1f5f9" : "#fff",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || userInput.trim() === ""}
              style={{
                background: loading ? "#94c6ff" : "#1e90e8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loading ? (
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
                  Thinking...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>

        {/* Section 4: Final Result Section (Dummy) */}
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
            {/* Dummy data */}
            Final AD scan result: No suspicious activity detected.
          </div>
        </div>

        {/* Section 5: Recommendation Section (Dummy) */}
        <div
          style={{
            maxWidth: 700,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
            padding: 32,
          }}
        >
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>5. Recommendations</h2>
          <ul style={{ fontSize: 17, paddingLeft: 24, color: "#64748b" }}>
            <li>Continue monitoring for unusual ads.</li>
            <li>Report any suspicious content.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}