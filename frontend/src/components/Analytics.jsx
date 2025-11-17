import React, { useState } from "react";
import { BarChart2, PieChart, Activity } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";

export default function Analytics() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 60 : 220;

  const fakeSeries = [
    { label: "AD Positive", value: 287, color: "#ef4444" },
    { label: "AD Negative", value: 3134, color: "#10b981" },
    { label: "Pending", value: 19, color: "#f59e0b" },
  ];

  return (
    <>
      <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <AdminNavbar sidebarCollapsed={collapsed} setSidebarCollapsed={setCollapsed} />
      <main
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 120,
          padding: 24,
          minHeight: "100vh",
          background: "linear-gradient(135deg,#f8fafc 0%, #ffffff 100%)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 24, flexDirection: "column" }}>
          <section style={{ background: "#fff", borderRadius: 12, padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>Analytics & Reports</h2>
              <div style={{ color: "#64748b", marginTop: 6 }}>Overview of model performance and system usage</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={{ background: "#1e90e8", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8 }}>Export CSV</button>
              <button style={{ background: "#f3f4f6", color: "#111827", border: "none", padding: "8px 12px", borderRadius: 8 }}>Refresh</button>
            </div>
          </section>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 12, padding: 20 }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}><BarChart2 /> Detection Trend</h3>
              <div style={{ height: 160, background: "#f8fafc", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                Placeholder chart (line)
              </div>
            </div>

            <div style={{ width: 300, background: "#fff", borderRadius: 12, padding: 20 }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}><PieChart /> Summary</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {fakeSeries.map((s) => (
                  <li key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 4, background: s.color }} />
                      <span style={{ color: "#334155" }}>{s.label}</span>
                    </div>
                    <strong>{s.value}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 12, padding: 20 }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}><Activity /> Key Metrics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Images Analyzed</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>3,421</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>AD Cases</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>287</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Pending Reviews</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>19</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Model Uptime</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>99.9%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}