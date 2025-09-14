import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const Email2FA = () => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const user_id = location.state?.user_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await axios.post('http://127.0.0.1:8000/api/verify-2fa/', { code, user_id });
      setMessage('2FA successful! Redirecting...');
      setTimeout(() => navigate('/landing'), 1500);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || err.message));
    }
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
        {message && <p style={{textAlign: 'center', color: message.startsWith('Error') ? 'red' : 'green'}}>{message}</p>}
      </div>
    </div>
  );
};

export default Email2FA;