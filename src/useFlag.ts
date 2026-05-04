import { useFlagContext } from './context';

export function useFlag(name: string): boolean {
  return useFlagContext().isEnabled(name);
}

export function useFlagState(name: string) {
  const state = useFlagContext();

  return {
    enabled: state.isEnabled(name),
    loading: state.loading,
    refreshing: state.refreshing,
    stale: state.stale,
    error: state.error,
    payload: state.getPayload(name),
    refetch: state.refetch,
    trackExposure: () => state.trackExposure(name, state.variants[name]),
  };
}

export function useFlagPayload<T = unknown>(
  name: string,
  defaultPayload?: T
): T | undefined {
  return useFlagContext().getPayload<T>(name, defaultPayload);
}
