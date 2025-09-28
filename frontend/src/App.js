import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import PasswordResetRequest from './components/PasswordResetRequest';
import PasswordResetConfirm from './components/PasswordResetConfirm';
import LandingPage from './components/LandingPage';
import Email2FA from './components/Email2FA';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/password-reset" element={<PasswordResetRequest />} />
        <Route path="/password-reset-confirm" element={<PasswordResetConfirm />} />
        <Route path="/2fa" element={<Email2FA />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
