import React, { useState, useEffect } from "react";
import "../index.css";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import { Users, Activity } from "lucide-react";
import api from "../utils/api";

export default function AdminDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [totals, setTotals] = useState({ users: "—", scans: "—" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      try {
        const res = await api.get("/admin/analytics/");
        if (!mounted) return;
        const data = res.data || {};
        setTotals({
          users: data.totals?.users ?? 0,
          scans: data.totals?.scans ?? 0,
        });
      } catch (err) {
        console.error("Failed to load admin analytics", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAnalytics();
    return () => {
      mounted = false;
    };
  }, []);

  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  return (
    <div>
      <AdminSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          background: "var(--color-background)",
          paddingTop: 72,
        }}
      >
        <AdminNavbar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />

        <main style={{ padding: 32 }}>
          <section
            style={{
              borderRadius: 16,
              padding: 32,
              marginBottom: 32,
              background: "linear-gradient(135deg,#1e90e8,#0ea5e9)",
              color: "#fff",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>AD Detection Admin Dashboard</h2>
            <p style={{ margin: "8px 0 0", opacity: 0.95 }}>High-level summary</p>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28, maxWidth: 880 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
                minHeight: 140,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: "#e6f0ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1e90e8",
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>Total Users</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{loading ? "…" : totals.users}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
                minHeight: 140,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: "#eef6ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0ea5e9",
                  }}
                >
                  <Activity size={20} />
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>Total Scans</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{loading ? "…" : totals.scans}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}