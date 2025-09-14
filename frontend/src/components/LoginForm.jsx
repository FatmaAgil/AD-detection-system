import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

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

const linkStyle = {
  display: 'block',
  marginTop: '16px',
  color: '#007bff',
  textDecoration: 'underline',
  textAlign: 'center',
  fontSize: '15px',
  cursor: 'pointer'
};

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f6fa'
};

const LoginForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/login/', {
        username: formData.username,
        password: formData.password
      });
      setMessage('2FA code sent to your email!');
      setTimeout(() => {
        navigate('/2fa', { state: { user_id: res.data.user_id } });
      }, 1500); // Redirect to 2FA page
    } catch (err) {
      setMessage('Login failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{textAlign: 'center', marginBottom: '24px'}}>Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            style={inputStyle}
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            style={inputStyle}
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <button style={buttonStyle} type="submit">Login</button>
        </form>
        {message && <p style={{color: message.includes('successful') ? 'green' : 'red', textAlign: 'center'}}>{message}</p>}
        <Link to="/signup" style={linkStyle}>
          Don't have an account? Sign Up
        </Link>
        <Link to="/password-reset" style={linkStyle}>
          Forgot password?
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;