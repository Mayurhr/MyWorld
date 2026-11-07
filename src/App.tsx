import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { AllCertificates } from './pages/AllCertificates';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminProjects } from './pages/admin/AdminProjects';
import { AdminCertificates } from './pages/admin/AdminCertificates';
import { AdminProfile } from './pages/admin/AdminProfile';
import { AdminResume } from './pages/admin/AdminResume';
import { AdminMediaManager } from './pages/admin/AdminMediaManager';
import { AdminQualifications } from './pages/admin/AdminQualifications';
import { AdminSkills } from './pages/admin/AdminSkills';
import { AdminConnect } from './pages/admin/AdminConnect';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminMessages } from './pages/admin/AdminMessages';
import { AdminAccountSettings } from './pages/admin/AdminAccountSettings';

export const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Portfolio Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/certificates" element={<AllCertificates />} />
          <Route path="/all-certificates" element={<Navigate to="/certificates" replace />} />

          {/* Admin Login */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="qualifications" element={<AdminQualifications />} />
            <Route path="skills" element={<AdminSkills />} />
            <Route path="connect" element={<AdminConnect />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="resume" element={<AdminResume />} />
            <Route path="media" element={<AdminMediaManager />} />
            <Route path="account" element={<AdminAccountSettings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
};
