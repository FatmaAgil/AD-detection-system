import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const cardStyle = {
  maxWidth: '400px',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  background: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif'
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  margin: '10px 0',
  borderRadius: '8px',
  border: '1px solid #ccc',
  fontSize: '16px'
};

const buttonStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: 'none',
  background: '#007bff',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '16px',
  cursor: 'pointer',
  marginTop: '10px'
};

const PasswordResetRequest = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await axios.post('http://127.0.0.1:8000/api/password_reset/', { email });
      setMessage('If this email exists, a password reset link has been sent.');
      setTimeout(() => {
        navigate('/password-reset-confirm', { state: { email } });
      }, 1500); // Wait 1.5 seconds before redirecting
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa'}}>
      <div style={cardStyle}>
        <h2 style={{textAlign: 'center', marginBottom: '24px'}}>Reset Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            style={inputStyle}
            type="email"
            name="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button style={buttonStyle} type="submit">Send Reset Link</button>
        </form>
        {message && <p style={{textAlign: 'center', color: message.startsWith('Error') ? 'red' : 'green'}}>{message}</p>}
      </div>
    </div>
  );
};

export default PasswordResetRequest;