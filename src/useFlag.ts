import { useFlagContext } from './context';
import { booleanVariant, useReportExposure } from './exposure';
import type { FlagReadOptions } from './types';

/**
 * Read a boolean flag, reporting the read as an exposure.
 *
 * Reading a flag's value *is* the exposure — that is the event an analytics backend needs to
 * attribute anything to a variant. Reporting therefore defaults to on: it used to default to
 * off, with the result that the overwhelmingly common call (`useFlag('x')`) emitted nothing
 * and flags looked untouched no matter how much traffic they gated.
 *
 * This is inert unless the provider was given an `exposureEndpoint` (and/or an `onExposure`
 * handler), so turning it on cannot start unexpected network traffic. Pass
 * `{ trackExposure: false }` for a read that genuinely is not an exposure — a debug panel
 * listing flag states, or an admin screen rendering someone else's configuration.
 */
export function useFlag(name: string, options?: FlagReadOptions): boolean {
  const state = useFlagContext();
  const enabled = state.isEnabled(name);

  useReportExposure(
    state,
    name,
    // A multivariate flag reports its variant; a boolean flag reports its value.
    state.variants[name] ?? booleanVariant(enabled),
    options?.trackExposure ?? true
  );

  return enabled;
}

export function useFlagState(name: string, options?: FlagReadOptions) {
  const state = useFlagContext();
  const enabled = state.isEnabled(name);
  const variant = state.variants[name] ?? booleanVariant(enabled);

  useReportExposure(state, name, variant, options?.trackExposure ?? true);

  return {
    enabled,
    loading: state.loading,
    refreshing: state.refreshing,
    stale: state.stale,
    error: state.error,
    payload: state.getPayload(name),
    refetch: state.refetch,
    trackExposure: () => state.trackExposure(name, state.variants[name]),
  };
}

/**
 * Read a flag's JSON payload.
 *
 * Reporting defaults to **off** here, unlike `useFlag`. A payload is remote configuration
 * rather than an experiment arm, and payload flags are commonly read on every render of
 * unrelated UI; counting those as exposures would inflate a flag's traffic without telling
 * anyone anything. Pass `{ trackExposure: true }` when the payload really is the treatment.
 */
export function useFlagPayload<T = unknown>(
  name: string,
  defaultPayload?: T,
  options?: FlagReadOptions
): T | undefined {
  const state = useFlagContext();

  useReportExposure(
    state,
    name,
    state.variants[name],
    options?.trackExposure ?? false
  );

  return state.getPayload<T>(name, defaultPayload);
}
