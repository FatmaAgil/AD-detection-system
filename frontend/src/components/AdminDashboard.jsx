import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa'}}>
      <div style={{maxWidth: '500px', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', background: '#fff'}}>
        <h2 style={{textAlign: 'center'}}>Admin Dashboard</h2>
        <p style={{textAlign: 'center'}}>Welcome, Admin! You can manage users and create new admins here.</p>
        {/* Add admin actions/components here */}
        <button
          style={{width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#dc3545', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '20px'}}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;