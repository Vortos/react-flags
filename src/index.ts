export { FeatureFlagProvider } from './FeatureFlagProvider';
export { FeatureFlag } from './FeatureFlag';
export { useFlag, useFlagPayload, useFlagState } from './useFlag';
export { useVariant, useVariantState } from './useVariant';
export { useFlagContext } from './context';
export type { FeatureFlagProviderProps } from './FeatureFlagProvider';
export type { FeatureFlagProps } from './FeatureFlag';
export type {
  ExposureEvent,
  FlagContextValue,
  FlagResponse,
  FlagState,
  FlagTargetingContext,
  VariantOptions,
} from './types';

// Request plumbing shared by the provider surface.
export { HttpError } from './request';
export type { HeadersInput, UnauthorizedHandler } from './request';
