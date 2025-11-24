import React, { useEffect, useState } from 'react';
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";
import api from '../utils/api';

const ChatHistory = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      // remove the extra "/api" here if your api instance already adds it as baseURL
      const response = await api.get('/scan-history/');
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (chatId) => {
    try {
      // matches backend: download-scan-pdf/<id>/
      const response = await api.get(`/download-scan-pdf/${chatId}/`, {
        responseType: 'blob'
      });
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ad_scan_report_${chatId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handleViewDetails = async (chatId) => {
    try {
      // matches backend: scan-details/<id>/
      const response = await api.get(`/scan-details/${chatId}/`);
      setSelectedChat(response.data);
    } catch (error) {
      console.error('Error fetching chat details:', error);
      alert('Failed to load scan details.');
    }
  };

  const handleDeleteScan = async (chatId) => {
    if (window.confirm('Are you sure you want to delete this scan? This action cannot be undone.')) {
      try {
        // matches backend: delete-scan/<id>/
        await api.delete(`/delete-scan/${chatId}/`);
        alert('Scan deleted successfully!');
        fetchChats(); // Refresh the list
      } catch (error) {
        console.error('Error deleting scan:', error);
        alert('Failed to delete scan. Please try again.');
      }
    }
  };

  const handleCloseDetails = () => {
    setSelectedChat(null);
  };

  // Extract risk estimate from chat messages
  const getRiskEstimate = (chat) => {
    const aiMessage = chat.messages.find(msg => msg.sender === 'ai');
    if (aiMessage && aiMessage.meta && aiMessage.meta.risk_estimate !== undefined) {
      return (aiMessage.meta.risk_estimate * 100).toFixed(0) + '%';
    }
    return 'N/A';
  };

  // Extract model used from chat messages
  const getModelUsed = (chat) => {
    const aiMessage = chat.messages.find(msg => msg.sender === 'ai');
    if (aiMessage && aiMessage.meta && aiMessage.meta.model_used) {
      return aiMessage.meta.model_used;
    }
    return 'Unknown Model';
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
          maxWidth: 800,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(33,150,243,0.08)",
          padding: 32,
        }}>
          <h2 style={{ color: "#1e90e8", marginBottom: 24 }}>Scan History</h2>
          {chats.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 16, textAlign: 'center', padding: '40px' }}>
              No scan history found. Complete a scan to see your history here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {chats.map((chat) => (
                <div key={chat.id} style={{
                  background: "#f7fafd",
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(33,150,243,0.04)",
                  border: "1px solid #e5e7eb",
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: "bold", color: "#1e90e8", fontSize: 16, marginBottom: 4 }}>
                        {new Date(chat.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                        Model: {getModelUsed(chat)} | Risk: {getRiskEstimate(chat)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleViewDetails(chat.id)}
                        style={{
                          background: "#1e90e8",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(chat.id)}
                        style={{
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Download PDF
                      </button>
                      <button
                        onClick={() => handleDeleteScan(chat.id)}
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: 12 }}>
                    {chat.messages.slice(0, 2).map((msg, idx) => (
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
                          fontSize: 14,
                          maxWidth: "70%",
                        }}>
                          <strong>{msg.sender === "ai" ? "AI: " : "You: "}</strong>
                          {msg.text}
                        </span>
                      </div>
                    ))}
                    {chat.messages.length > 2 && (
                      <div style={{ fontSize: 12, color: "#666", textAlign: 'center', marginTop: 8 }}>
                        + {chat.messages.length - 2} more messages
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed View Modal */}
      {selectedChat && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '600px',
            maxHeight: '80%',
            width: '90%',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#1e90e8', margin: 0 }}>Scan Details</h3>
              <button
                onClick={handleCloseDetails}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#666"
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <strong>Created:</strong> {new Date(selectedChat.created_at).toLocaleString()}
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#334155', marginBottom: '12px' }}>Messages:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedChat.messages.map((msg, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    background: msg.sender === 'ai' ? '#f0f9ff' : '#f3f4f6',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${msg.sender === 'ai' ? '#1e90e8' : '#10b981'}`
                  }}>
                    <div style={{ fontWeight: 'bold', color: msg.sender === 'ai' ? '#1e90e8' : '#10b981', marginBottom: '4px' }}>
                      {msg.sender === 'ai' ? 'AI Assistant' : 'You'}:
                    </div>
                    <div style={{ color: '#334155' }}>{msg.text}</div>
                    {msg.meta && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        <strong>Metadata:</strong> {JSON.stringify(msg.meta)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              {selectedChat.has_pdf && (
                <button
                  onClick={() => handleDownloadPdf(selectedChat.id)}
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Download Full PDF
                </button>
              )}
              <button
                onClick={handleCloseDetails}
                style={{
                  background: "#6b7280",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;