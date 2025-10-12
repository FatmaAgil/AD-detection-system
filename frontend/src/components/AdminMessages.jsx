import React, { useEffect, useState, useRef } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";

const API_URL = "http://localhost:8000/api/messages/";

export default function AdminMessages() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const replyInputRef = useRef();

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setLoading(false);
      });
  }, []);

  const handleReply = async (msgId) => {
    const res = await fetch(`${API_URL}${msgId}/reply/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ reply_text: replyText }),
    });
    if (res.ok) {
      setReplyingId(null);
      setReplyText("");
      // Optionally, refresh replies/messages
    }
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    const res = await fetch(`${API_URL}${msgId}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    });
    if (res.ok) {
      setMessages(messages.filter((m) => m.id !== msgId));
    }
  };

  const handleEdit = async (msgId) => {
    const res = await fetch(`${API_URL}${msgId}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ ...messages.find((m) => m.id === msgId), message: editText }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditText("");
      // Optionally, refresh messages
    }
  };

  const handleEditReply = async (replyId) => {
    const res = await fetch(`http://localhost:8000/api/replies/${replyId}/`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reply_text: editText }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditText("");
      // Refresh messages
      setLoading(true);
      fetch(API_URL)
        .then((res) => res.json())
        .then((data) => {
          setMessages(data);
          setLoading(false);
        });
    }
  };

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
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(33,150,243,0.08)",
                  padding: 24,
                  position: "relative"
                }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: "bold", color: "#1e90e8", fontSize: 18 }}>{msg.name}</span>
                    <span style={{ marginLeft: 12, color: "#64748b", fontSize: 15 }}>{msg.email}</span>
                    <span style={{ marginLeft: "auto", color: "#aaa", fontSize: 13 }}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ color: "#64748b" }}>User message:</strong>
                    <div style={{
                      background: "#f5f5f5",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      marginTop: 4,
                      fontSize: 16
                    }}>
                      {msg.message}
                    </div>
                  </div>
                  {msg.replies && msg.replies.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ color: "#1e90e8" }}>Admin reply:</strong>
                      {editingId === msg.replies[0].id ? (
                        <div style={{
                          background: "#e7f4ff",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          marginTop: 4
                        }}>
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #b3d7f6",
                              padding: 8,
                              fontSize: 15,
                              marginBottom: 8
                            }}
                          />
                          <button
                            onClick={() => handleEditReply(msg.replies[0].id)}
                            style={{
                              background: "#1e90e8",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 16px",
                              fontWeight: "bold",
                              marginRight: 8,
                              cursor: "pointer"
                            }}
                          >Save</button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              background: "#eee",
                              color: "#333",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 16px",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >Cancel</button>
                        </div>
                      ) : (
                        <div style={{
                          background: "#e7f4ff",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center"
                        }}>
                          <span style={{ flex: 1 }}>{msg.replies[0].reply_text}</span>
                          <button
                            style={{
                              marginLeft: 12,
                              background: "#1e90e8",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                            onClick={() => {
                              setEditingId(msg.replies[0].id);
                              setEditText(msg.replies[0].reply_text);
                            }}
                          >Edit Reply</button>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12 }}>
                    {!msg.replies?.length && (
                      <button
                        onClick={() => setReplyingId(msg.id)}
                        style={{
                          background: "#1e90e8",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >Reply</button>
                    )}
                    <button
                      onClick={() => handleDelete(msg.id)}
                      style={{
                        background: "#e53e3e",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >Delete</button>
                  </div>
                  {replyingId === msg.id && (
                    <div style={{
                      marginTop: 16,
                      background: "#f5f5f5",
                      padding: "10px 14px",
                      borderRadius: "8px"
                    }}>
                      <textarea
                        ref={replyInputRef}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{
                          width: "100%",
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          padding: 8,
                          fontSize: 15,
                          marginBottom: 8
                        }}
                        placeholder="Type your reply..."
                      />
                      <button
                        onClick={() => handleReply(replyingId)}
                        style={{
                          background: "#1e90e8",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontWeight: "bold",
                          marginRight: 8,
                          cursor: "pointer"
                        }}
                      >Send Reply</button>
                      <button
                        onClick={() => setReplyingId(null)}
                        style={{
                          background: "#eee",
                          color: "#333",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >Cancel</button>
                    </div>
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