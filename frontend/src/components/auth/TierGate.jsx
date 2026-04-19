import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

// TierGate component with named export
export const TierGate = ({ children, requiredTier, fallback }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userTier = user?.verificationTier || 'basic';
  const tierLevels = { basic: 1, standard: 2, verified: 3, premium: 4, enterprise: 5 };
  
  if (tierLevels[userTier] < tierLevels[requiredTier]) {
    return fallback || <Navigate to="/verify" replace />;
  }

  return children;
};

// ALSO export as default for flexibility
export default TierGate;