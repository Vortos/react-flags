import React, { useEffect } from 'react';
import { useFlagState } from './useFlag';

export interface FeatureFlagProps {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  trackExposure?: boolean;
}

export function FeatureFlag({
  name,
  children,
  fallback = null,
  loadingFallback = null,
  trackExposure = false,
}: FeatureFlagProps) {
  const { enabled, loading, trackExposure: recordExposure } = useFlagState(name);

  useEffect(() => {
    if (enabled && trackExposure) {
      recordExposure();
    }
  }, [enabled, recordExposure, trackExposure]);

  if (loading && loadingFallback) {
    return <>{loadingFallback}</>;
  }

  if (enabled) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
