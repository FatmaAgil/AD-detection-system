import React, { useState } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";

export default function AdScan() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [images, setImages] = useState([]);
  const [results, setResults] = useState([]); // <-- new

  // Section 1: Upload Images
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 10); // Limit to 10 images
    setImages(files);

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const res = await fetch('http://localhost:8000/api/adscan/upload/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        // Do NOT set Content-Type for FormData
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      // set results from backend predictions
      setResults(data.results || []);
      alert("Images uploaded and analyzed successfully!");
    } else {
      const error = await res.json().catch(() => ({}));
      alert(error.error || error.detail || "Upload failed.");
    }
  };

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
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(33,150,243,0.08)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 18 }}>1. Upload Images</h2>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            style={{ marginBottom: 12 }}
          />
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              {Array.from(images).map((img, idx) => (
                <img
                  key={idx}
                  src={URL.createObjectURL(img)}
                  alt={`upload-${idx}`}
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Result Section - show model results */}
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#f7fafd",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>2. Scan Result</h2>

          {results.length === 0 ? (
            <div style={{ fontSize: 17, color: "#64748b" }}>
              No scans yet. Upload images to analyze.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {results.map((r, i) => {
                const localImg = images[i] ? URL.createObjectURL(images[i]) : (r.uploaded.image || null);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {localImg && (
                      <img src={localImg} alt={`res-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: r.prediction.label === 'ad' ? '#d9534f' : '#2f855a' }}>
                        {r.prediction.label.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        Confidence: {(r.prediction.score * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Chat Section (Dummy) */}
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>3. AI Chat</h2>
          <div style={{ minHeight: 80, marginBottom: 16 }}>
            {/* Dummy chat history */}
            <div style={{ textAlign: "left", marginBottom: 8 }}>
              <span style={{
                display: "inline-block",
                background: "#e7f4ff",
                color: "#333",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 16,
                maxWidth: "70%",
              }}>
                <strong>AI: </strong>Can you tell me more about the context of these images?
              </span>
            </div>
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <span style={{
                display: "inline-block",
                background: "#d1fae5",
                color: "#333",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 16,
                maxWidth: "70%",
              }}>
                <strong>You: </strong>These are ads from my recent browsing.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Final Result Section (Dummy) */}
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#f7fafd",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 12 }}>4. Final Result</h2>
          <div style={{ fontSize: 17, color: "#64748b" }}>
            {/* Dummy data */}
            Final AD scan result: No suspicious activity detected.
          </div>
        </div>

        {/* Section 5: Recommendation Section (Dummy) */}
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
          padding: 32,
        }}>
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