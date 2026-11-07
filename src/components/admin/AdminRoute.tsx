import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading, logout } = useAdminAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a1a1aa',
          gap: '16px',
        }}
      >
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Verifying administrator credentials...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};
