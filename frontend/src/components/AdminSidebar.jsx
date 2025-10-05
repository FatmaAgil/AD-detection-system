import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Image,
  BarChart3,
  Activity,
  Settings,
  Stethoscope,
  Mail, // <-- Import the Mail icon from lucide-react
} from "lucide-react";

const navItems = [
  { to: "/admin-dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/users", label: "User Management", icon: <Users size={20} /> },
  { to: "/admin-messages", label: "Messages", icon: <Mail size={20} /> }, // <-- Use Mail icon for Messages
  { to: "/content", label: "Content", icon: <FileText size={20} /> },
  { to: "/analysis", label: "Analysis", icon: <Image size={20} /> },
  { to: "/analytics", label: "Analytics", icon: <BarChart3 size={20} /> },
  { to: "/health", label: "Health", icon: <Activity size={20} /> },
  { to: "/settings", label: "Settings", icon: <Settings size={20} /> },
];

export default function AdminSidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      style={{
        height: "100vh",
        background: "var(--color-sidebar)",
        color: "#fff",
        width: collapsed ? 60 : 220,
        transition: "width 0.2s",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: 20 }}>
        <Stethoscope size={28} />
        {!collapsed && <span style={{ fontWeight: "bold", marginLeft: 10 }}>AD Admin</span>}
        <button
          style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer" }}
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              textDecoration: "none",
              color: "#fff",
              background: location.pathname === item.to ? "#2563eb" : "none",
              borderRadius: 8,
              margin: "4px 8px",
              fontWeight: location.pathname === item.to ? "bold" : "normal",
            }}
            title={collapsed ? item.label : undefined}
          >
            <span style={{ marginRight: collapsed ? 0 : 12, display: "flex", alignItems: "center" }}>
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
      <div style={{ margin: 20, display: "flex", alignItems: "center" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", marginRight: 8 }}></span>
        {!collapsed && <span style={{ fontSize: 12 }}>System Healthy</span>}
      </div>
    </aside>
  );
}