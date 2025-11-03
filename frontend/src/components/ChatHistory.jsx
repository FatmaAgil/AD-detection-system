import React, { useState, useEffect } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import { loadChats } from "../utils/chatStorage"; // added import

const dummyChats = [
  {
    id: 1,
    date: "2025-10-10 14:23",
    messages: [
      { sender: "user", text: "Hi, I need help with my ad scan." },
      { sender: "ai", text: "Sure! Can you upload the affected images?" },
      { sender: "user", text: "Here are the images." },
      { sender: "ai", text: "Scan complete. No suspicious activity detected." },
    ],
  },
  {
    id: 2,
    date: "2025-10-09 09:11",
    messages: [
      { sender: "user", text: "Can you explain the scan result?" },
      { sender: "ai", text: "Of course! The scan found no issues." },
    ],
  },
];

export default function ChatHistory() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  const [chats, setChats] = useState(() => {
    const stored = loadChats();
    return stored.length ? stored : dummyChats;
  });

  useEffect(() => {
    // keep simple: reload on mount; user can click Refresh to re-read
    const onStorage = () => setChats(loadChats());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Download chat as text file
  const handleDownload = (chat) => {
    const content = chat.messages
      .map((msg) => `${msg.sender === "ai" ? "AI" : "You"}: ${msg.text}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_${chat.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshFromStorage = () => {
    const stored = loadChats();
    setChats(stored.length ? stored : []);
  };

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
          <div style={{ marginBottom: 12 }}>
            <button onClick={refreshFromStorage} style={{ marginRight: 8 }}>Refresh</button>
          </div>
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
                  position: "relative"
                }}>
                  <div style={{ fontWeight: "bold", color: "#1e90e8", fontSize: 15, marginBottom: 8 }}>
                    {chat.date}
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
                  <button
                    onClick={() => handleDownload(chat)}
                    style={{
                      position: "absolute",
                      top: 18,
                      right: 18,
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
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}