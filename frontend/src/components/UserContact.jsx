import React, { useState, useEffect } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import { FiMail, FiSend, FiMessageCircle } from "react-icons/fi";

const API_URL = "http://localhost:8000/api/messages/";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [myMessages, setMyMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/my-messages/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setMyMessages(Array.isArray(data) ? data : []);
        setLoadingMessages(false);
      })
      .catch(() => {
        setMyMessages([]);
        setLoadingMessages(false);
      });
  }, []);

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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #e3f0ff 0%, #f9fbfd 100%)" }}>
      <UserSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <UserNavbar sidebarWidth={sidebarWidth} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 72, // This is the current gap
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 40,
          marginTop: 32, // Add this line for extra gap below navbar
        }}
      >
        {/* Messages & Replies Card */}
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 6px 32px rgba(33,150,243,0.10)",
          padding: 36,
          marginBottom: 40, // Add spacing below messages
        }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <FiMessageCircle size={28} style={{ color: "#1e90e8", marginRight: 10 }} />
            <h2 style={{ fontWeight: 700, fontSize: 24, color: "#1e90e8", margin: 0 }}>My Messages & Replies</h2>
          </div>
          {loadingMessages ? (
            <div style={{ color: "#64748b", fontSize: 16 }}>Loading...</div>
          ) : myMessages.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 16 }}>You haven't sent any messages yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {myMessages.map((msg) => (
                <div key={msg.id} style={{
                  background: "#f7fafd",
                  borderRadius: 12,
                  padding: 18,
                  boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
                  transition: "box-shadow 0.2s",
                  border: "1px solid #e5e7eb"
                }}>
                  <div style={{ fontWeight: "bold", color: "#1e90e8", fontSize: 15 }}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong style={{ color: "#64748b" }}>Your message:</strong>
                    <div style={{ marginTop: 4, fontSize: 16 }}>{msg.message}</div>
                  </div>
                  {msg.replies && msg.replies.length > 0 && (
                    <div style={{
                      marginTop: 16,
                      background: "#e7f4ff",
                      borderRadius: 8,
                      padding: 14,
                      boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
                      border: "1px solid #b3d7f6"
                    }}>
                      <strong style={{ color: "#1e90e8" }}>Admin reply:</strong>
                      <div style={{ marginTop: 4, fontSize: 16 }}>{msg.replies[0].reply_text}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Contact Form Card */}
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 6px 32px rgba(33,150,243,0.10)",
          padding: 36,
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <FiMail size={28} style={{ color: "#1e90e8", marginRight: 10 }} />
            <h2 style={{ fontWeight: 700, fontSize: 24, color: "#1e90e8", margin: 0 }}>Contact Admin</h2>
          </div>
          <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your Name"
              required
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 17,
                background: "#f7fafd",
                transition: "border 0.2s",
              }}
            />
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Your Email"
              type="email"
              required
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 17,
                background: "#f7fafd",
                transition: "border 0.2s",
              }}
            />
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              placeholder="Your message or concern"
              required
              rows={5}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 17,
                background: "#f7fafd",
                resize: "vertical",
                transition: "border 0.2s",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#1e90e8",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 0",
                fontWeight: "bold",
                fontSize: 17,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(33,150,243,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.2s",
              }}
            >
              <FiSend size={20} />
              Send
            </button>
            {status && (
              <div style={{
                color: status === "Message sent!" ? "#22c55e" : "#e53e3e",
                fontWeight: 500,
                marginTop: 6,
                textAlign: "center",
                fontSize: 15,
                transition: "color 0.2s"
              }}>
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}