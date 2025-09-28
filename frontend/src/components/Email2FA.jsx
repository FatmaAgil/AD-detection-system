import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const Email2FA = () => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user_id = location.state?.user_id;
  const initialRole = location.state?.role;
  //const username = location.state?.username; // If you have username from login

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/verify-2fa/', { code, user_id });
      const role = res.data.role || initialRole;
      setMessage('2FA successful! Redirecting...');
      setTimeout(() => {
        if (role === 'admin') {
          navigate('/admin-dashboard');
        } else if (role === 'general_user') {
          navigate('/landing');
        } else {
          navigate('/login');
        }
      }, 1500);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    try {
      // You may need to POST username/password or user_id depending on your backend
      await axios.post('http://127.0.0.1:8000/api/resend-2fa/', { user_id });
      setMessage('A new 2FA code has been sent to your email.');
    } catch (err) {
      setMessage('Error resending code: ' + (err.response?.data?.detail || err.message));
    }
    setResending(false);
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa'}}>
      <div style={{maxWidth: '400px', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', background: '#fff'}}>
        <h2 style={{textAlign: 'center', marginBottom: '24px'}}>Enter 2FA Code</h2>
        <form onSubmit={handleSubmit}>
          <input
            style={{width: '100%', padding: '12px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px'}}
            type="text"
            name="code"
            placeholder="Enter code from email"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
          />
          <button style={{width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#007bff', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px'}} type="submit">Verify</button>
        </form>
        <button
          style={{width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#6c757d', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px'}}
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Resending...' : 'Resend 2FA Code'}
        </button>
        {message && <p style={{textAlign: 'center', color: message.startsWith('Error') ? 'red' : 'green'}}>{message}</p>}
      </div>
    </div>
  );
};

export default Email2FA;