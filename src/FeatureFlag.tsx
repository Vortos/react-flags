import React from 'react';
import { useFlagContext } from './context';
import { booleanVariant, useReportExposure } from './exposure';
import type { FeatureFlagProps } from './types';

/**
 * Renders `children` when the flag is on, `fallback` when it is off.
 *
 * Reports an exposure **whichever branch renders**. It used to report only when the flag was
 * on, which quietly made every experiment unanalysable: with no exposures from the control
 * group there is nothing to compare the treatment against, and the results read as though
 * only the treatment had users.
 *
 * Inert unless the provider was given an `exposureEndpoint`.
 */
export function FeatureFlag({
  name,
  children,
  fallback = null,
  loadingFallback = null,
  trackExposure = true,
}: FeatureFlagProps) {
  const state = useFlagContext();
  const enabled = state.isEnabled(name);

  useReportExposure(
    state,
    name,
    state.variants[name] ?? booleanVariant(enabled),
    trackExposure
  );

  if (state.loading && loadingFallback) {
    return <>{loadingFallback}</>;
  }

  return <>{enabled ? children : fallback}</>;
}
