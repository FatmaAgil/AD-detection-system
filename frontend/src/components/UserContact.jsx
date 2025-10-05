import React, { useState } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";

const API_URL = "http://localhost:8000/api/messages/";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Sending...");
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setStatus("Message sent!");
      setForm({ name: "", email: "", message: "" });
    } else {
      setStatus("Failed to send. Try again.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f2f8fa" }}>
      <UserSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <UserNavbar sidebarWidth={sidebarWidth} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 72,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 500, width: "100%", background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(33,150,243,0.08)", padding: 32 }}>
          <h2>Contact Admin</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your Name"
              required
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
            />
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Your Email"
              type="email"
              required
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
            />
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              placeholder="Your message or concern"
              required
              rows={5}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
            />
            <button
              type="submit"
              style={{
                background: "#1e90e8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 0",
                fontWeight: "bold",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Send
            </button>
            {status && <div style={{ color: status === "Message sent!" ? "green" : "red" }}>{status}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}