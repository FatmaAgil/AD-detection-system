import React, { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";

const API_URL = "http://localhost:8000/api/users/";

const COLORS = {
  card: "#fff",
  background: "#f2f8fa",
  primary: "#1e90e8",
  shadow: "0 4px 24px rgba(33,150,243,0.08)",
  border: "#e5e7eb",
  success: "#22c55e",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", email: "", password: "", password2: "", is_staff: false });
  const [editId, setEditId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 60 : 220;
  const [loading, setLoading] = useState(false);

  // Fetch users from backend
  const fetchUsers = () => {
    fetch(API_URL)
      .then((res) => res.json())
      .then(setUsers);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Create or update user
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const method = editId ? "PUT" : "POST";
    const url = editId ? `${API_URL}${editId}/` : API_URL;
    const body = { ...form };
    if (!editId) {
      // On create, password is required
      if (!form.password || !form.password2) {
        setLoading(false);
        return alert("Password and confirmation required");
      }
    } else {
      // On update, remove empty password fields
      if (!form.password) delete body.password;
      if (!form.password2) delete body.password2;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      fetchUsers();
      setForm({ username: "", email: "", password: "", password2: "", is_staff: false });
      setEditId(null);
    } else {
      const err = await res.json();
      alert(JSON.stringify(err));
    }
    setLoading(false);
  };

  // Edit user
  const handleEdit = (user) => {
    setEditId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      password2: "",
      is_staff: user.is_staff,
    });
  };

  // Delete user
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    await fetch(`${API_URL}${id}/`, { method: "DELETE" });
    fetchUsers();
    if (editId === id) {
      setEditId(null);
      setForm({ username: "", email: "", password: "", password2: "", is_staff: false });
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditId(null);
    setForm({ username: "", email: "", password: "", password2: "", is_staff: false });
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.background }}>
      <AdminSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          background: "var(--color-background)",
          paddingTop: 72,
        }}
      >
        <AdminNavbar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />
        <div
          style={{
            padding: 32,
            marginTop: 24,
          }}
        >
          <div
            style={{
              background: COLORS.card,
              borderRadius: 16,
              padding: 32,
              boxShadow: COLORS.shadow,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <h2 style={{ marginTop: 0, color: COLORS.primary, fontWeight: "bold" }}>User Management</h2>
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 32,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  minWidth: 120,
                  fontSize: 16,
                }}
                required
              />
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                type="email"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  minWidth: 180,
                  fontSize: 16,
                }}
                required
              />
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={editId ? "New Password (optional)" : "Password"}
                type="password"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  minWidth: 140,
                  fontSize: 16,
                }}
                required={!editId}
              />
              <input
                name="password2"
                value={form.password2}
                onChange={handleChange}
                placeholder={editId ? "Confirm New Password" : "Confirm Password"}
                type="password"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  minWidth: 140,
                  fontSize: 16,
                }}
                required={!editId}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16 }}>
                <input
                  type="checkbox"
                  name="is_staff"
                  checked={form.is_staff}
                  onChange={handleChange}
                  style={{ marginRight: 4 }}
                />
                Admin
              </label>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: COLORS.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 28px",
                  fontWeight: "bold",
                  fontSize: 16,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(33,150,243,0.10)",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {editId ? (loading ? "Updating..." : "Update") : (loading ? "Adding..." : "Add")}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    background: "#aaa",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: "bold",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
            <div
              style={{
                overflowX: "auto",
                borderRadius: 12,
                boxShadow: COLORS.shadow,
                background: COLORS.card,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: COLORS.background }}>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Username</th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Email</th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Role</th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: "bold", color: "#64748b" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: 12 }}>{u.username}</td>
                      <td style={{ padding: 12 }}>{u.email}</td>
                      <td style={{ padding: 12, textTransform: "capitalize" }}>
                        <span
                          style={{
                            background: u.is_staff ? COLORS.primary : COLORS.success,
                            color: "#fff",
                            borderRadius: 6,
                            padding: "4px 12px",
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          {u.is_staff ? "Admin" : "User"}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          onClick={() => handleEdit(u)}
                          style={{
                            marginRight: 8,
                            background: "#fbbf24",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, textAlign: "center", color: "#aaa" }}>
                        No users registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}