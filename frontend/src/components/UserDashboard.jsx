import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Add this import
import { Camera, MessageSquare } from "lucide-react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";

// Sidebar navigation items
/*const nav = [
  { name: "Dashboard", path: "/dashboard", icon: Home },
  { name: "AD Scan", path: "/scan", icon: Camera },
  { name: "Chat History", path: "/chat", icon: MessageSquare },
  { name: "Contact", path: "/contact", icon: Phone },
  { name: "Profile", path: "/profile", icon: User },
];*/

// Dashboard cards
const cards = [
  { title: "Total Scans", value: "12", icon: Camera, trend: "+2 this month" },
  { title: "Recommendations", value: "3", icon: MessageSquare, trend: "2 pending" },
  { title: "Chat Sessions", value: "8", icon: MessageSquare, trend: "1 active" },
];

// Mock scan history
const scanHistory = [
  { date: "2024-01-15", result: "No AD detected", confidence: "92%" },
  { date: "2024-01-10", result: "Potential AD", confidence: "78%" },
];

const COLORS = {
  sidebar: "#1e90e8",
  sidebarActive: "#007bff",
  sidebarHover: "#1b7fc7",
  background: "#f2f8fa",
  card: "#fff",
  accent: "#00b8b8",
  primary: "#1e90e8",
  gradient1: "#1e90e8",
  gradient2: "#00b8b8",
  text: "#1a202c",
  success: "#22c55e",
  warning: "#f59e42",
  yellow: "#eab308",
};

export default function UserDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 60 : 220;
  const navigate = useNavigate();

  // Get username from localStorage (set this after login/2FA)
  const username = localStorage.getItem("username") || "User";

  return (
    <div style={{ minHeight: "100vh", background: COLORS.background, display: "flex" }}>
      {/* Sidebar */}
      <UserSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main layout (navbar + content) */}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: 72, // Add this line
        }}
      >
        {/* Navbar */}
        <UserNavbar sidebarWidth={sidebarWidth} />

        {/* Main content */}
        <main style={{ padding: 32, flex: 1 }}>
          {/* Hero section */}
          <section
            style={{
              borderRadius: 16,
              padding: 32,
              marginBottom: 32,
              background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
              color: "#fff",
            }}
          >
            <h2 style={{ fontSize: 28, fontWeight: "bold", margin: 0 }}>
              Welcome, {username}
            </h2>
            <p style={{ margin: "12px 0 20px" }}>Your atopic dermatitis detection dashboard</p>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                style={{
                  background: "#fff",
                  color: COLORS.primary,
                  fontWeight: "bold",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  marginRight: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
                onClick={() => navigate("/scan")} // <-- Go to AD Scan page
              >
                New Scan
              </button>
              <button
                style={{
                  background: COLORS.gradient2,
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
                onClick={() => navigate("/chat")} // <-- Go to Chat History page
              >
                View History
              </button>
            </div>
          </section>

          {/* Stats cards */}
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 32,
              flexWrap: "wrap",
            }}
          >
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  style={{
                    background: COLORS.card,
                    borderRadius: 12,
                    padding: 24,
                    flex: "1 1 200px",
                    minWidth: 200,
                    textAlign: "center",
                    boxShadow: "0 4px 24px rgba(33, 150, 243, 0.08)",
                  }}
                >
                  <Icon color={COLORS.primary} style={{ marginBottom: 8 }} size={32} />
                  <div style={{ fontSize: 28, fontWeight: "bold" }}>{card.value}</div>
                  <div style={{ color: COLORS.success, fontSize: 14 }}>{card.trend}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>{card.title}</div>
                </div>
              );
            })}
          </div>

          {/* Recent scan results */}
          <div
            style={{
              background: COLORS.card,
              borderRadius: 12,
              padding: 24,
              marginBottom: 32,
              boxShadow: "0 4px 24px rgba(33, 150, 243, 0.08)",
            }}
          >
            <h3 style={{ fontWeight: "bold", marginTop: 0, marginBottom: 16 }}>Recent Scan Results</h3>
            <ul style={{ paddingLeft: 0, margin: 0, listStyle: "none" }}>
              {scanHistory.map((scan, idx) => (
                <li key={idx} style={{ marginBottom: 8 }}>
                  {scan.date}:{" "}
                  <span
                    style={{
                      fontWeight: "bold",
                      color: scan.result === "No AD detected" ? COLORS.success : COLORS.yellow,
                    }}
                  >
                    {scan.result}
                  </span>{" "}
                  ({scan.confidence})
                </li>
              ))}
            </ul>
          </div>

          {/* Health tips carousel */}
          <div
            style={{
              background: COLORS.card,
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 4px 24px rgba(33, 150, 243, 0.08)",
            }}
          >
            <h3 style={{ fontWeight: "bold", marginTop: 0, marginBottom: 16 }}>Health Tips</h3>
            <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
              <div
                style={{
                  minWidth: 200,
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: 12,
                  padding: 16,
                  marginRight: 8,
                }}
              >
                Moisturize daily to reduce flare-ups.
              </div>
              <div
                style={{
                  minWidth: 200,
                  background: COLORS.primary,
                  color: "#fff",
                  borderRadius: 12,
                  padding: 16,
                  marginRight: 8,
                }}
              >
                Avoid harsh soaps and detergents.
              </div>
              <div
                style={{
                  minWidth: 200,
                  background: COLORS.gradient2,
                  color: "#fff",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                Consult a dermatologist if symptoms persist.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}