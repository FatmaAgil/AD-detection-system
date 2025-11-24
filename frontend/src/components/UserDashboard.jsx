import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, MessageSquare } from "lucide-react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import api from "../utils/api";

const COLORS = {
  sidebar: "#1e90e8",
  background: "#f2f8fa",
  card: "#fff",
  primary: "#1e90e8",
  success: "#22c55e",
  yellow: "#eab308",
};

export default function UserDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 60 : 220;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    total_scans: 0,
    pdf_reports: 0,
    chat_sessions: 0,
    recommendations: 0,
  });
  const username = localStorage.getItem("username") || "User";

  useEffect(() => {
    let mounted = true;
    const fetchDashboard = async () => {
      try {
        const res = await api.get("/dashboard/");
        if (!mounted) return;
        const data = res.data || {};
        setTotals((data.totals) ? data.totals : totals);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDashboard();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.background, display: "flex" }}>
      <UserSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: 72,
        }}
      >
        <UserNavbar sidebarWidth={sidebarWidth} />

        <main style={{ padding: 32, flex: 1 }}>
          <section
            style={{
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primary})`,
              color: "#fff",
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>Welcome, {username}</h2>
            <p style={{ margin: "8px 0 0", opacity: 0.9 }}>Your atopic dermatitis detection dashboard</p>
            <div style={{ marginTop: 16 }}>
              <button
                style={{
                  background: "#fff",
                  color: COLORS.primary,
                  fontWeight: "bold",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  marginRight: 8,
                }}
                onClick={() => navigate("/scan")}
              >
                New Scan
              </button>
              <button
                style={{
                  background: "#fff",
                  color: COLORS.primary,
                  fontWeight: "600",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
                onClick={() => navigate("/chat")}
              >
                View History
              </button>
            </div>
          </section>

          {/* Updated: use responsive grid and more polished card layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)", // two cards per row
              gap: 28,
              marginBottom: 24,
              alignItems: "stretch",
            }}
          >
            <div style={metricCard}>
              <div style={metricHead}>
                <div style={{ ...metricIcon, background: "#e6f0ff", color: COLORS.primary }}>
                  <Camera size={18} />
                </div>
                <div style={metricLabel}>Total Scans</div>
              </div>
              <div style={metricValue}>{loading ? "…" : totals.total_scans}</div>
            </div>

            <div style={metricCard}>
              <div style={metricHead}>
                <div style={{ ...metricIcon, background: "#eefdf3", color: COLORS.success }}>
                  <MessageSquare size={18} />
                </div>
                <div style={metricLabel}>Recommendations</div>
              </div>
              <div style={metricValue}>{loading ? "…" : totals.recommendations}</div>
            </div>

            <div style={metricCard}>
              <div style={metricHead}>
                <div style={{ ...metricIcon, background: "#fff8e6", color: COLORS.yellow }}>
                  <MessageSquare size={18} />
                </div>
                <div style={metricLabel}>Chat Sessions</div>
              </div>
              <div style={metricValue}>{loading ? "…" : totals.chat_sessions}</div>
            </div>

            <div style={metricCard}>
              <div style={metricHead}>
                <div style={{ ...metricIcon, background: "#f0f7ff", color: COLORS.primary }}>
                  <Camera size={18} />
                </div>
                <div style={metricLabel}>PDF Reports</div>
              </div>
              <div style={metricValue}>{loading ? "…" : totals.pdf_reports}</div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

const metricCard = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  height: 150, // fixed height so grid looks balanced and "filled"
  boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const metricHead = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const metricIcon = {
  width: 44,
  height: 44,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "inset 0 -4px 10px rgba(0,0,0,0.03)",
};

const metricLabel = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 600,
};

const metricValue = {
  color: "#0f172a",
  fontSize: 28,
  fontWeight: 800,
  marginTop: 6,
};