import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

const PasswordResetConfirm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = location.state?.email || '';
  const [formData, setFormData] = useState({
    email: initialEmail,
    token: '',
    password: '',
    password2: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (formData.password !== formData.password2) {
      setMessage('Passwords do not match.');
      return;
    }
    try {
      await axios.post('http://127.0.0.1:8000/api/password_reset/confirm/', {
        email: formData.email,
        token: formData.token,
        password: formData.password
      });
      setMessage('Password has been reset! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500); // Redirect after 1.5 seconds
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa'}}>
      <div style={cardStyle}>
        <h2 style={{textAlign: 'center', marginBottom: '24px'}}>Set New Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            style={inputStyle}
            type="email"
            name="email"
            placeholder="Your email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            style={inputStyle}
            type="text"
            name="token"
            placeholder="Reset token"
            value={formData.token}
            onChange={handleChange}
            required
          />
          <input
            style={inputStyle}
            type="password"
            name="password"
            placeholder="New password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            style={inputStyle}
            type="password"
            name="password2"
            placeholder="Confirm new password"
            value={formData.password2}
            onChange={handleChange}
            required
          />
          <button style={buttonStyle} type="submit">Reset Password</button>
        </form>
        {message && <p style={{textAlign: 'center', color: message.startsWith('Error') ? 'red' : 'green'}}>{message}</p>}
      </div>
    </div>
  );
};

export default PasswordResetConfirm;