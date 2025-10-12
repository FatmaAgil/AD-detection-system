import React, { useEffect, useState } from "react";
import UserSidebar from "./UserSidebar";
import UserNavbar from "./UserNavbar";

const API_URL = "http://localhost:8000/api/profile/";

export default function UserProfile() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [form, setForm] = useState({ username: "", email: "" }); // Remove role
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setForm({ username: data.username, email: data.email }); // Remove role
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setStatus("Profile updated!");
    } else {
      setStatus("Failed to update profile.");
    }
    setSaving(false);
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
          <h2>User Profile</h2>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16, width: "100%" }}
                  required
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  type="email"
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16, width: "100%" }}
                  required
                />
              </label>
              <label>
                New Password
                <input
                  name="password"
                  value={form.password || ""}
                  onChange={handleChange}
                  type="password"
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16, width: "100%" }}
                  placeholder="Leave blank to keep current password"
                />
              </label>
              <label>
                Confirm New Password
                <input
                  name="password2"
                  value={form.password2 || ""}
                  onChange={handleChange}
                  type="password"
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16, width: "100%" }}
                  placeholder="Leave blank to keep current password"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#1e90e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontWeight: "bold",
                  fontSize: 16,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {status && <div style={{ color: status === "Profile updated!" ? "green" : "red" }}>{status}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}