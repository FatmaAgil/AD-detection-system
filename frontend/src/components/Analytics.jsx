import React, { useEffect, useState, useMemo, useRef } from "react";
import { BarChart2, PieChart, Activity } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import api from "../utils/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Analytics() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 60 : 220;

  // single source of truth for navbar height
  const headerHeight = 72;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const mainRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!mainRef.current) return;
    try {
      setDownloadingPdf(true);
      // capture at higher scale for better quality
      const canvas = await html2canvas(mainRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      // create pdf sized to the captured image (keeps layout)
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save("admin-analytics.pdf");
    } catch (err) {
      console.error("Failed to create analytics PDF", err);
      alert("Failed to create PDF. See console for details.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      try {
        const res = await api.get("/admin/analytics/");
        if (!mounted) return;
        setData(res.data);
      } catch (err) {
        setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAnalytics();
    return () => { mounted = false; };
  }, []);

  const scansSeries = useMemo(() => {
    if (!data || !data.scans_per_day) return [];
    const items = Object.entries(data.scans_per_day).sort(([a], [b]) => a.localeCompare(b));
    return items.map(([day, count]) => ({ day, count }));
  }, [data]);

  const modelUsageSeries = useMemo(() => {
    if (!data || !data.model_usage) return [];
    return Object.entries(data.model_usage).map(([k, v]) => ({ label: k, value: v }));
  }, [data]);

  if (loading) return <div style={styles.loading}>Loading analytics…</div>;
  if (error) return <div style={styles.error}>Error loading analytics</div>;

  const totals = data.totals || {};
  const maxCount = scansSeries.reduce((mx, s) => Math.max(mx, s.count), 1);

  return (
    <>
      <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <AdminNavbar sidebarCollapsed={collapsed} setSidebarCollapsed={setCollapsed} />
      <main ref={mainRef} style={{ ...styles.main, marginLeft: sidebarWidth, paddingTop: headerHeight + 24 }}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Admin Analytics</h1>
            <p style={styles.subtitle}>Overview of users, scans, model usage and recent activity</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Download analytics as PDF (screenshot)"
            >
              {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>

        <section style={styles.cardGrid}>
          <MetricCard title="Users" value={totals.users ?? 0} />
          <MetricCard title="Total Scans" value={totals.scans ?? 0} />
          <MetricCard title="PDF Reports" value={totals.pdf_reports ?? 0} />
          <MetricCard title="Images Analyzed" value={totals.images_analyzed ?? 0} />
        </section>

        <div style={styles.row}>
          <div style={styles.leftCol}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div style={styles.panelTitle}><BarChart2 /> <span style={{ marginLeft: 8 }}>Scans (last 30 days)</span></div>
                <div style={styles.panelMeta}>Total: {totals.scans ?? 0}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                {scansSeries.length === 0 && <div style={styles.muted}>No scans in the last 30 days</div>}
                {scansSeries.map((s) => (
                  <div key={s.day} style={styles.barRow}>
                    <div style={styles.barLabel}>{s.day}</div>
                    <div style={styles.barTrack}>
                      <div style={{ ...styles.barFill, width: `${(s.count / maxCount) * 100}%` }} />
                    </div>
                    <div style={styles.barCount}>{s.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...styles.panel, marginTop: 20 }}>
              <div style={styles.panelHeader}>
                <div style={styles.panelTitle}><Activity /> <span style={{ marginLeft: 8 }}>Recent Scans</span></div>
                <div style={styles.panelMeta}>Latest 10</div>
              </div>
              <div style={{ marginTop: 12 }}>
                {data.recent_scans && data.recent_scans.length === 0 && <div style={styles.muted}>No recent scans</div>}
                {data.recent_scans && data.recent_scans.map((r) => (
                  <div key={r.id} style={styles.recentRow}>
                    <div>
                      <div style={styles.recentId}>Scan #{r.id}</div>
                      <div style={styles.recentMeta}>{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={styles.recentTag}>{r.model_used ?? "unknown"}</div>
                      <div style={styles.recentSmall}>{r.has_pdf ? "PDF" : "No PDF"} • risk: {r.risk_estimate ?? "N/A"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside style={styles.rightCol}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div style={styles.panelTitle}><PieChart /> <span style={{ marginLeft: 8 }}>Model Usage</span></div>
                <div style={styles.panelMeta}>Distribution</div>
              </div>
              <div style={{ marginTop: 12 }}>
                {modelUsageSeries.length === 0 && <div style={styles.muted}>No model usage data</div>}
                {modelUsageSeries.map((m, idx) => {
                  const total = modelUsageSeries.reduce((s, x) => s + x.value, 0) || 1;
                  const pct = Math.round((m.value / total) * 100);
                  const color = colors[idx % colors.length];
                  return (
                    <div key={m.label} style={styles.usageRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 12, height: 12, background: color, borderRadius: 3 }} />
                        <div style={styles.usageLabel}>{m.label}</div>
                      </div>
                      <div style={styles.usageRight}>
                        <div style={styles.usageValue}>{m.value}</div>
                        <div style={styles.usagePct}>{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Links panel removed */}

          </aside>
        </div>
      </main>
    </>
  );
}

/* ---------- small presentational components & styles ---------- */

const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function MetricCard({ title, value }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles = {
  main: {
    transition: "margin-left 0.2s",
    padding: 24,
    minHeight: "100vh",
    background: "#f8fafc",
    boxSizing: "border-box"
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
    fontWeight: 700
  },
  subtitle: {
    margin: 0,
    marginTop: 6,
    color: "#475569",
    fontSize: 13
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 18
  },
  metricCard: {
    background: "#ffffff",
    padding: 18,
    borderRadius: 10,
    boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 88,
    justifyContent: "center"
  },
  metricTitle: {
    color: "#64748b",
    fontSize: 13
  },
  metricValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 700
  },
  row: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
    flexWrap: "wrap"
  },
  leftCol: {
    flex: "1 1 720px",
    minWidth: 360
  },
  rightCol: {
    width: 340,
    flexShrink: 0
  },
  panel: {
    background: "#fff",
    padding: 18,
    borderRadius: 10,
    boxShadow: "0 6px 18px rgba(15,23,42,0.04)"
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  panelTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#0f172a",
    fontWeight: 700
  },
  panelMeta: {
    color: "#6b7280",
    fontSize: 13
  },
  muted: {
    color: "#64748b",
    fontSize: 13
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10
  },
  barLabel: {
    width: 110,
    color: "#475569",
    fontSize: 13
  },
  barTrack: {
    flex: 1,
    height: 12,
    background: "#f1f5f9",
    borderRadius: 6,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    background: "#3b82f6",
    borderRadius: 6
  },
  barCount: {
    width: 44,
    textAlign: "right",
    color: "#334155",
    fontWeight: 700
  },
  recentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9"
  },
  recentId: {
    fontWeight: 700,
    color: "#0f172a"
  },
  recentMeta: {
    color: "#64748b",
    fontSize: 12
  },
  recentTag: {
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    display: "inline-block",
    fontWeight: 600
  },
  recentSmall: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6
  },
  usageRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #f8fafc"
  },
  usageLabel: {
    color: "#0f172a",
    fontWeight: 600
  },
  usageRight: {
    display: "flex",
    gap: 10,
    alignItems: "center"
  },
  usageValue: {
    color: "#0f172a",
    fontWeight: 700
  },
  usagePct: {
    color: "#64748b",
    fontSize: 13
  },
  link: {
    color: "#0f172a",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 8,
    background: "#f8fafc",
    display: "inline-block"
  },
  loading: {
    padding: 24,
    color: "#475569"
  },
  error: {
    padding: 24,
    color: "#ef4444"
  }
};