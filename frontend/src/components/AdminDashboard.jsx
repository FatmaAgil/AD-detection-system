import React, { useState, useEffect, useRef } from "react";
import {  Routes, Route } from "react-router-dom";
import "../index.css";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  Users,
  Image as ImageIcon,
  Activity,
  FileText,
} from "lucide-react";
import Analytics from "./Analytics";

// Dashboard Overview content
function DashboardOverview({ stats }) {
  return (
    <div>
      <section className="medical-gradient" style={{ borderRadius: 16, padding: 32, marginBottom: 32 }}>
        <h2 style={{ color: "#fff", fontSize: 28, margin: 0 }}>Welcome to the AD Detection Admin Dashboard</h2>
        <p style={{ color: "#fff", margin: "12px 0 20px" }}>
          Monitor, manage, and support atopic dermatitis detection for Kenyan healthcare.
        </p>
        <button style={{ background: "#fff", color: "var(--color-primary)", fontWeight: "bold", padding: "8px 20px", borderRadius: 8, border: "none" }}>
          Add New Case
        </button>
      </section>
      <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-shadow"
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              flex: "1 1 200px",
              minWidth: 200,
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: "bold" }}>{stat.value}</div>
            <div style={{ color: "#22c55e", fontSize: 14 }}>{stat.change}</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>{stat.label}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{stat.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, flex: 1, minWidth: 260 }}>
          <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
          <ul>
            <li>🩺 New AD case detected in Nairobi</li>
            <li>👩‍⚕️ Dr. Achieng registered</li>
            <li>⚠️ Model update deployed</li>
            <li>🧑‍⚕️ Health worker added in Kisumu</li>
          </ul>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, flex: 1, minWidth: 260 }}>
          <h3 style={{ marginTop: 0 }}>System Status</h3>
          <ul>
            <li>ML Model: <span style={{ color: "#22c55e" }}>Healthy</span></li>
            <li>Database: <span style={{ color: "#22c55e" }}>Connected</span></li>
            <li>Storage: <span style={{ color: "#22c55e" }}>OK</span></li>
            <li>API: <span style={{ color: "#22c55e" }}>Online</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Placeholder for other pages
function Placeholder({ title }) {
  return <div style={{ padding: 32, background: "#fff", borderRadius: 12 }}>{title} (Coming Soon)</div>;
}

// Main Admin Dashboard layout
export default function AdminDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(window.scrollY);

  // dynamic stats
  const [stats, setStats] = useState([
    { key: "users", label: "Total Users", value: 0, change: "+0%", desc: "Admins & general users", icon: <Users color="var(--color-primary)" size={28} /> },
    { key: "images", label: "Images Analyzed", value: 3421, change: "+8%", desc: "Skin images processed", icon: <ImageIcon color="var(--color-primary)" size={28} /> },
    { key: "ad_cases", label: "AD Cases Detected", value: 287, change: "+2%", desc: "Positive detections", icon: <Activity color="var(--color-primary)" size={28} /> },
    { key: "pending", label: "Pending Reviews", value: 19, change: "-1%", desc: "Cases needing review", icon: <FileText color="var(--color-primary)" size={28} /> },
  ]);

  useEffect(() => {
    // fetch admin stats once on mount
    async function fetchStats() {
      try {
        const token = localStorage.getItem("access_token"); // adjust if you store tokens elsewhere
        const res = await fetch("http://localhost:8000/api/admin/stats/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.user_count === "number") {
          setStats((s) => s.map(st => st.key === "users" ? { ...st, value: data.user_count } : st));
        }
      } catch (err) {
        console.error("Failed to load admin stats", err);
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 10) {
        setShowHeader(true);
        lastScrollY.current = window.scrollY;
        return;
      }
      if (window.scrollY > lastScrollY.current) {
        // Scrolling down
        setShowHeader(false);
      } else {
        // Scrolling up
        setShowHeader(true);
      }
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      <AdminSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div
        style={{
          marginLeft: sidebarCollapsed ? 60 : 220,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          background: "var(--color-background)",
          paddingTop: 72, // Add this!
        }}
      >
        <AdminNavbar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          showHeader={showHeader}
        />
        <main style={{ padding: 32 }}>
          <Routes>
            <Route path="/" element={<DashboardOverview stats={stats} />} />
            <Route path="/users" element={<Placeholder title="User Management" />} />
            <Route path="/admins" element={<Placeholder title="Admin Management" />} />
            <Route path="/content" element={<Placeholder title="Content Management" />} />
            <Route path="/analysis" element={<Placeholder title="Image Analysis Monitor" />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/health" element={<Placeholder title="System Health" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}