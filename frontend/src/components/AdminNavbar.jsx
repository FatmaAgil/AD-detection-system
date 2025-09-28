import React from "react";
import { Bell, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminNavbar({ sidebarCollapsed, setSidebarCollapsed, showHeader = true }) {
  const navigate = useNavigate();
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  return (
    <header
      style={{
        display: showHeader ? "flex" : "none",
        alignItems: "center",
        justifyContent: "space-between",
        height: 72,
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        padding: "0 32px",
        position: "fixed",
        top: 0,
        left: sidebarWidth,
        width: `calc(100% - ${sidebarWidth}px)`,
        zIndex: 100,
        transition: "left 0.2s, width 0.2s",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div>
         
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}>
          <Bell size={22} aria-label="Notifications" />
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -8,
              background: "#ef4444",
              color: "#fff",
              fontSize: 12,
              borderRadius: "50%",
              padding: "2px 6px",
              fontWeight: "bold",
            }}
          >
            1
          </span>
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "#222",
            fontSize: 22,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          aria-label="Logout"
          title="Logout"
        >
          <User size={22} /> <span style={{ fontSize: 14 }}>Logout</span>
        </button>
      </div>
    </header>
  );
}