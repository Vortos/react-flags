import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlagContext } from './context';
import {
  fetchJson,
  headersIdentity,
  resolveHeaders,
  stableSerialize,
} from './request';
import type { HeadersInput, UnauthorizedHandler } from './request';
import type {
  ExposureEvent,
  FlagContextValue,
  FlagResponse,
  FlagState,
  FlagTargetingContext,
} from './types';

export interface FeatureFlagProviderProps {
  endpoint?: string;
  children: React.ReactNode;
  /**
   * Request headers. Pass a function for anything that expires: the provider polls on
   * its own schedule, and a fixed object freezes whatever token it held at mount.
   */
  headers?: HeadersInput;
  /**
   * Called when a fetch comes back 401/403. Renew the credentials and return `true` to
   * retry the fetch once with freshly resolved headers.
   */
  onUnauthorized?: UnauthorizedHandler;
  context?: FlagTargetingContext;
  contextHeaderName?: string;
  initialFlags?: string[];
  initialVariants?: Record<string, string>;
  initialPayloads?: Record<string, unknown>;
  initialVersion?: string | null;
  refreshInterval?: number;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  retries?: number;
  retryDelayMs?: number;
  cacheKey?: string;
  persist?: boolean;
  exposureEndpoint?: string;
  onExposure?: (event: ExposureEvent) => void;
  onError?: (error: Error) => void;
  onUpdate?: (state: FlagState) => void;
}

const defaultState: FlagState = {
  flags: [],
  variants: {},
  payloads: {},
  version: null,
  loading: true,
  refreshing: false,
  stale: true,
  error: null,
  lastUpdatedAt: null,
};

export function FeatureFlagProvider({
  endpoint = '/api/flags',
  headers = {},
  context,
  contextHeaderName = 'X-Vortos-Flag-Context',
  children,
  initialFlags,
  initialVariants = {},
  initialPayloads = {},
  initialVersion = null,
  refreshInterval,
  refetchOnWindowFocus = false,
  staleTime,
  retries = 0,
  retryDelayMs = 500,
  cacheKey,
  persist = false,
  exposureEndpoint,
  onExposure,
  onError,
  onUpdate,
  onUnauthorized,
}: FeatureFlagProviderProps) {
  const headersKey = headersIdentity(headers);
  const contextKey = stableSerialize(context ?? {});

  // Read through refs so an interval fetch scheduled an hour ago still calls the current
  // resolver and the current handler, without either one's identity forcing `refetch` to
  // be rebuilt (which would restart the polling interval on every render).
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  // Resolved per attempt, not once at mount, so a rotated token reaches the next poll.
  const requestHeaders = useCallback(
    async () =>
      withTargetingContext(
        await resolveHeaders(headersRef.current),
        context,
        contextHeaderName
      ),
    [headersKey, contextHeaderName, contextKey]
  );
  const handleUnauthorized = useCallback<UnauthorizedHandler>(
    (error) => onUnauthorizedRef.current?.(error) ?? false,
    []
  );
  const cachedState = readCachedState(cacheKey);
  const initialState = useMemo<FlagState>(() => {
    if (cachedState) {
      return {
        ...cachedState,
        stale: isStale(cachedState.lastUpdatedAt, staleTime),
      };
    }

    if (initialFlags) {
      return {
        flags: initialFlags,
        variants: initialVariants,
        payloads: initialPayloads,
        version: initialVersion,
        loading: false,
        refreshing: false,
        stale: isStale(Date.now(), staleTime),
        error: null,
        lastUpdatedAt: Date.now(),
      };
    }

    return defaultState;
  }, []);
  const [state, setState] = useState<FlagState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const trackedExposuresRef = useRef<Set<string>>(new Set());

  const applyState = useCallback(
    (next: FlagState) => {
      setState(next);

      if (persist && cacheKey) {
        writeCachedState(cacheKey, next);
      }

      onUpdate?.(next);
    },
    [cacheKey, onUpdate, persist]
  );

  const refetch = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setState((current: FlagState) => ({
      ...current,
      loading: current.lastUpdatedAt === null,
      refreshing: current.lastUpdatedAt !== null,
      error: null,
    }));

    try {
      const data = await fetchJson<FlagResponse>({
        endpoint,
        headers: requestHeaders,
        signal: controller.signal,
        retries,
        retryDelayMs,
        onUnauthorized: handleUnauthorized,
      });

      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      applyState({
        flags: data.flags ?? [],
        variants: data.variants ?? {},
        payloads: data.payloads ?? {},
        version: data.version ?? null,
        loading: false,
        refreshing: false,
        stale: false,
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      const normalized = normalizeError(error);
      onError?.(normalized);

      setState((current: FlagState) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: normalized,
      }));
    }
  }, [
    applyState,
    endpoint,
    handleUnauthorized,
    onError,
    requestHeaders,
    retries,
    retryDelayMs,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [refetch]);

  useEffect(() => {
    if (!refreshInterval) {
      return;
    }

    const interval = window.setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => window.clearInterval(interval);
  }, [refetch, refreshInterval]);

  useEffect(() => {
    if (!refetchOnWindowFocus) {
      return;
    }

    const onFocus = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      if (!staleTime || isStale(state.lastUpdatedAt, staleTime)) {
        refetch();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refetch, refetchOnWindowFocus, staleTime, state.lastUpdatedAt]);

  useEffect(() => {
    if (!staleTime || state.lastUpdatedAt === null) {
      return;
    }

    const remaining = staleTime - (Date.now() - state.lastUpdatedAt);

    if (remaining <= 0) {
      setState((current: FlagState) => ({ ...current, stale: true }));
      return;
    }

    const timeout = window.setTimeout(() => {
      setState((current: FlagState) => ({ ...current, stale: true }));
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [staleTime, state.lastUpdatedAt]);

  const trackExposure = useCallback(
    (name: string, variant?: string) => {
      const exposureKey = `${name}:${variant ?? ''}`;

      if (trackedExposuresRef.current.has(exposureKey)) {
        return;
      }

      trackedExposuresRef.current.add(exposureKey);

      const event: ExposureEvent = {
        name,
        variant,
        timestamp: Date.now(),
      };

      onExposure?.(event);

      if (exposureEndpoint) {
        // Exposure is fire-and-forget telemetry, but it still needs a live token, so
        // resolve the headers at send time like every other request.
        void (async () => {
          try {
            await fetch(exposureEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(await requestHeaders()),
              },
              body: JSON.stringify(event),
            });
          } catch (error) {
            onError?.(normalizeError(error));
          }
        })();
      }
    },
    [exposureEndpoint, onError, onExposure, requestHeaders]
  );

  const value = useMemo<FlagContextValue>(() => {
    const isEnabled = (name: string) => state.flags.includes(name);
    const getVariant = (name: string, defaultVariant = 'control') =>
      state.variants[name] ?? defaultVariant;
    const getPayload = <T,>(name: string, defaultPayload?: T) =>
      (state.payloads[name] as T | undefined) ?? defaultPayload;

    return {
      ...state,
      refetch,
      isEnabled,
      getVariant,
      getPayload,
      trackExposure,
    };
  }, [refetch, state, trackExposure]);

  return <FlagContext.Provider value={value}>{children}</FlagContext.Provider>;
}

function withTargetingContext(
  headers: Record<string, string>,
  context: FlagTargetingContext | undefined,
  contextHeaderName: string
): Record<string, string> {
  if (!context) {
    return headers;
  }

  return {
    ...headers,
    [contextHeaderName]: stableSerialize(context),
  };
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isStale(lastUpdatedAt: number | null, staleTime?: number): boolean {
  if (!staleTime || lastUpdatedAt === null) {
    return false;
  }

  return Date.now() - lastUpdatedAt >= staleTime;
}

function readCachedState(cacheKey?: string): FlagState | null {
  if (!cacheKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as FlagState) : null;
  } catch {
    return null;
  }
}

function writeCachedState(cacheKey: string, state: FlagState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(state));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}
