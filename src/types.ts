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

export interface VariantOptions<TAllowed extends string = string> {
  default: TAllowed;
  allowed?: readonly TAllowed[];
  trackExposure?: boolean;
}

export interface ExposureEvent {
  name: string;
  variant?: string;
  timestamp: number;
}
