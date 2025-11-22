import React, { useState, useMemo } from "react";

/*
  UniversalSymptomForm
  Props:
    - scanResults: array (results from image upload)
    - userType: "patient" | "clinician"
    - onFormSubmit: function(report) -> called after successful API response
    - modelUsed: string (model name used for analysis)
*/
export default function UniversalSymptomForm({ scanResults = [], userType = "patient", onFormSubmit = () => {}, modelUsed = "" }) {
  const QUESTIONS = useMemo(() => ([
    {
      id: "symptom_duration",
      question: "How long have these skin symptoms been present?",
      options: [
        "Less than 1 week",
        "1-4 weeks",
        "1-3 months",
        "Over 3 months"
      ]
    },
    {
      id: "itching_severity",
      question: "How intense is the itching?",
      options: [
        "No itching",
        "Mild (occasional, not bothersome)",
        "Moderate (daily, somewhat bothersome)",
        "Severe (constant, disrupts sleep/daily life)"
      ]
    },
    {
      id: "skin_texture",
      question: "How does the affected skin feel to the touch?",
      options: [
        "Smooth/normal",
        "Slightly rough or dry",
        "Very rough, scaly, or leathery",
        "Oozing, crusting, or open sores"
      ]
    },
    {
      id: "location_pattern",
      question: "Where are the main affected areas located?",
      options: [
        "Face or neck only",
        "Skin folds (elbows, knees, wrists)",
        "Widespread but in specific areas",
        "Generalized/covering large areas"
      ]
    },
    {
      id: "pigmentation_changes",
      question: "Have you noticed any skin color changes in affected areas?",
      options: [
        "No color changes",
        "Slight darkening or lightening",
        "Moderate color changes that come and go",
        "Significant dark/light spots that persist"
      ]
    }
  ]), []);

  const total = QUESTIONS.length;
  const [answers, setAnswers] = useState(() => {
    const init = {};
    QUESTIONS.forEach(q => init[q.id] = null);
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const answeredCount = Object.values(answers).filter(v => v !== null).length;
  const progress = Math.round((answeredCount / total) * 100);

  const skinToneContext = (modelUsed || "").toLowerCase().includes("dark") ? "Dark skin context (dark-optimized model used)" : "Light/General model context";

  function handleSelect(qid, idx) {
    setAnswers(prev => ({ ...prev, [qid]: idx }));
    setError(null);
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    // basic validation: all questions answered
    const missing = Object.entries(answers).filter(([k,v]) => v === null).map(([k]) => k);
    if (missing.length > 0) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setLoading(true);
    setError(null);

    // prepare payload: symptom_answers values as integers (0..3)
    const symptom_answers = {};
    Object.entries(answers).forEach(([k,v]) => {
      symptom_answers[k] = v;
    });

    const payload = {
      symptom_answers,
      scan_results: scanResults || [],
      user_type: userType || "patient",
      detected_skin_tone: skinToneContext.includes("Dark") ? "dark" : "light"
    };

    try {
      const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
      const endpoint = `${API_BASE}/api/universal-assessment/`;
      console.debug("Submitting assessment to", endpoint, payload);
      const res = await fetch(endpoint, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
         },
         body: JSON.stringify(payload)
       });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (res.ok) {
        setReport(data);
        onFormSubmit && onFormSubmit(data);
      } else {
        const serverMsg = data.error || data.detail || data.message || data.raw || `HTTP ${res.status}`;
        console.error("Assessment failed:", res.status, serverMsg, { payload, data });
        setError(`Assessment request failed: ${serverMsg}`);
      }
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: userType === "clinician" ? "#f8fafc" : "#fff",
      border: userType === "clinician" ? "1px solid #c7e0ff" : "1px solid #e6eef9",
      padding: 16,
      borderRadius: 12
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: "#0b6fbf" }}>Universal Symptom Assessment</h3>
          <div style={{ fontSize: 13, color: "#64748b" }}>{skinToneContext} • Model: {modelUsed || "N/A"}</div>
        </div>
        <div style={{ minWidth: 140 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Completion</div>
          <div style={{ background: "#e6eef9", height: 10, borderRadius: 6, overflow: "hidden" }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              background: progress >= 70 ? "#d9534f" : "#2f855a",
              transition: "width 200ms"
            }} />
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 6, textAlign: "right" }}>{answeredCount}/{total}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
        {QUESTIONS.map((q) => (
          <fieldset key={q.id} style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{q.question}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {q.options.map((opt, idx) => {
                const checked = answers[q.id] === idx;
                return (
                  <label key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: checked ? (userType === "clinician" ? "#e6f0ff" : "#e6fff0") : "#fff",
                    border: checked ? "1px solid #1e90e8" : "1px solid #e6eef9",
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    minWidth: 220
                  }}>
                    <input
                      type="radio"
                      name={q.id}
                      value={idx}
                      checked={checked}
                      onChange={() => handleSelect(q.id, idx)}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ fontSize: 14, color: "#0f172a" }}>{opt}</div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#94c6ff" : "#1e90e8",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700
            }}
          >
            {loading ? "Assessing..." : "Submit Assessment"}
          </button>

          <button
            type="button"
            onClick={() => {
              // reset
              setAnswers(Object.fromEntries(Object.keys(answers).map(k => [k, null])));
              setReport(null);
              setError(null);
            }}
            disabled={loading}
            style={{
              background: "#f3f4f6",
              color: "#111827",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600
            }}
          >
            Reset
          </button>
        </div>

        {/* show returned report if present */}
        {report && (
          <div style={{ marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #eef2f7" }}>
            <h4 style={{ margin: "0 0 6px 0" }}>{report.title || "Assessment Report"}</h4>
            <div style={{ color: "#334155", marginBottom: 8 }}>{report.summary || report.what_this_means || ""}</div>
            <div style={{ fontWeight: 700 }}>Final confidence: {(report.final_confidence != null) ? (report.final_confidence).toFixed(2) : "n/a"}</div>

            {report.recommendations && Array.isArray(report.recommendations) && (
              <>
                <div style={{ marginTop: 8, fontWeight: 700 }}>Recommendations</div>
                <ul style={{ marginTop: 6 }}>
                  {report.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
              </>
            )}

            {report.next_steps && Array.isArray(report.next_steps) && (
              <>
                <div style={{ marginTop: 8, fontWeight: 700 }}>Next steps</div>
                <ul style={{ marginTop: 6 }}>
                  {report.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}