export interface FlagResponse {
  flags?: string[];
  variants?: Record<string, string>;
  payloads?: Record<string, unknown>;
  version?: string;
}

export interface FlagState {
  flags: string[];
  variants: Record<string, string>;
  payloads: Record<string, unknown>;
  version: string | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error: Error | null;
  lastUpdatedAt: number | null;
}

export interface FlagContextValue extends FlagState {
  refetch: () => Promise<void>;
  isEnabled: (name: string) => boolean;
  getVariant: (name: string, defaultVariant?: string) => string;
  getPayload: <T = unknown>(name: string, defaultPayload?: T) => T | undefined;
  trackExposure: (name: string, variant?: string) => void;
}

export interface FlagTargetingContext {
  userId?: string;
  role?: string;
  roles?: string[];
  tenantId?: string;
  federationId?: string;
  country?: string;
  plan?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Options for a single flag read.
 *
 * `trackExposure` defaults to **true** for value reads (`useFlag`, `useVariant`,
 * `<FeatureFlag>`) because reading a flag's value is what an exposure *is*, and to **false**
 * for `useFlagPayload`, where the value is remote configuration rather than an experiment arm.
 * Set it explicitly for a read that is not a real exposure — a debug panel listing flag
 * states, or an admin screen rendering someone else's configuration.
 *
 * Exposure reporting is inert unless `FeatureFlagProvider` was given an `exposureEndpoint`
 * (and/or an `onExposure` handler).
 */
export interface FlagReadOptions {
  trackExposure?: boolean;
}

export interface VariantOptions<TAllowed extends string = string>
  extends FlagReadOptions {
  default: TAllowed;
  allowed?: readonly TAllowed[];
}

export interface FeatureFlagProps extends FlagReadOptions {
  name: string;
  children: import('react').ReactNode;
  fallback?: import('react').ReactNode;
  loadingFallback?: import('react').ReactNode;
}

export interface ExposureEvent {
  name: string;
  variant?: string;
  timestamp: number;
}
