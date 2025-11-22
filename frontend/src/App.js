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
import UserManagement from './components/UserManagement';
import Contact from './components/UserContact';
import AdminMessages from './components/AdminMessages';
import UserProfile from './components/UserProfile';
import AdScan from './components/AdScan';
import ChatHistory from './components/ChatHistory';
import Analytics from './components/Analytics';
import UniversalSymptomForm from './components/UniversalSymptomForm';

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
        <Route path="/users" element={<UserManagement />} />
        <Route path="/scan" element={<AdScan />} />
        <Route path="/chat" element={<ChatHistory />} />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin-messages" element={<AdminMessages />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/symptom-form" element={<UniversalSymptomForm />} />
      </Routes>
    </Router>
  );
}

export default App;
