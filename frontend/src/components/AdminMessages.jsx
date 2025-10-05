import React, { useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";

const API_URL = "http://localhost:8000/api/messages/";

export default function AdminMessages() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f2f8fa" }}>
      <AdminSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <AdminNavbar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 112, // Increased top padding for more space below navbar
          minHeight: "100vh",
          //padding: "64px 32px 32px 32px", // Increased top padding for content
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 4px 24px rgba(33,150,243,0.08)",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#1e90e8", fontWeight: "bold" }}>User Messages</h2>
          {loading ? (
            <div>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: "#aaa", textAlign: "center" }}>No messages found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f2f8fa" }}>
                  <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Email</th>
                  <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Message</th>
                  <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>{msg.name}</td>
                    <td style={{ padding: 12 }}>{msg.email}</td>
                    <td style={{ padding: 12 }}>{msg.message}</td>
                    <td style={{ padding: 12 }}>
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleString()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}