import React, { useState, useEffect } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import api from '../utils/api';  // Use the custom API instance

export default function ChatHistory() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await api.get('/chats/');
        setChats(res.data);
      } catch (err) {
        console.error('Error fetching chats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  const handleDownloadPdf = (pdfUrl) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #e3f0ff 0%, #f9fbfd 100%)" }}>
      <UserSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <UserNavbar sidebarWidth={sidebarWidth} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          paddingTop: 90,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        <div style={{
          maxWidth: 700,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(33,150,243,0.08)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 24 }}>Chat History</h2>
          {chats.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 16 }}>No chat history found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {chats.map((chat) => (
                <div key={chat.id} style={{
                  background: "#f7fafd",
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
                  border: "1px solid #e5e7eb",
                }}>
                  <div style={{ fontWeight: "bold", color: "#1e90e8", fontSize: 15, marginBottom: 8 }}>
                    {new Date(chat.created_at).toLocaleString()}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {chat.messages.map((msg, idx) => (
                      <div key={idx} style={{
                        textAlign: msg.sender === "ai" ? "left" : "right",
                        marginBottom: 6,
                      }}>
                        <span style={{
                          display: "inline-block",
                          background: msg.sender === "ai" ? "#e7f4ff" : "#d1fae5",
                          color: "#333",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 15,
                          maxWidth: "70%",
                        }}>
                          <strong>{msg.sender === "ai" ? "AI: " : "You: "}</strong>
                          {msg.text}
                        </span>
                      </div>
                    ))}
                  </div>
                  {chat.pdf_report && (
                    <button
                      onClick={() => handleDownloadPdf(chat.pdf_report)}
                      style={{
                        background: "#1e90e8",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontWeight: "bold",
                        fontSize: 15,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(33,150,243,0.08)",
                      }}
                    >
                      Download PDF Report
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}