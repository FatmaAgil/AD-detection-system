import React from "react";
import { Bell, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserNavbar({ sidebarWidth = 220 }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 72,
        padding: "0 40px",
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        position: "fixed",
        top: 0,
        left: sidebarWidth,
        width: `calc(100% - ${sidebarWidth}px)`,
        zIndex: 100,
        transition: "left 0.2s, width 0.2s",
        boxSizing: "border-box",
      }}
    >
      <div>
        {/* You can add a logo or title here if needed */}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}>
          <Bell />
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
            gap: 6,
          }}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut size={22} />
          <span style={{ fontSize: 14 }}>Logout</span>
        </button>
      </div>
    </header>
  );
}