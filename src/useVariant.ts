import { useFlagContext } from './context';
import { useReportExposure } from './exposure';
import type { VariantOptions } from './types';

/**
 * Read a multivariate flag's assigned variant, reporting the read as an exposure.
 *
 * Reporting defaults to on for the same reason as `useFlag`: an experiment with no exposure
 * events has no results. It stays inert unless the provider was given an `exposureEndpoint`.
 */
export function useVariant(name: string, defaultVariant?: string): string;
export function useVariant<TAllowed extends string>(
  name: string,
  options: VariantOptions<TAllowed>
): TAllowed;
export function useVariant<TAllowed extends string>(
  name: string,
  options: string | VariantOptions<TAllowed> = 'control'
): string {
  const state = useFlagContext();
  const variant = resolveVariant(state.getVariant(name, defaultOf(options)), options);

  useReportExposure(state, name, variant, shouldReport(options));

  return variant;
}

export function useVariantState<TAllowed extends string = string>(
  name: string,
  options: string | VariantOptions<TAllowed> = 'control'
) {
  const state = useFlagContext();
  const variant = resolveVariant(state.getVariant(name, defaultOf(options)), options);

  useReportExposure(state, name, variant, shouldReport(options));

  return {
    variant,
    loading: state.loading,
    refreshing: state.refreshing,
    stale: state.stale,
    error: state.error,
    refetch: state.refetch,
    trackExposure: () => state.trackExposure(name, variant),
  };
}

function defaultOf<TAllowed extends string>(
  options: string | VariantOptions<TAllowed>
): string {
  return typeof options === 'string' ? options : options.default;
}

/**
 * An assignment outside the declared `allowed` set falls back to the default, so a variant
 * removed from the flag but still live in a stale client cache cannot render a branch the code
 * no longer has. The *reported* variant is the resolved one, i.e. what the user actually saw.
 */
function resolveVariant<TAllowed extends string>(
  current: string,
  options: string | VariantOptions<TAllowed>
): string {
  if (typeof options === 'object' && options.allowed) {
    return options.allowed.includes(current as TAllowed)
      ? current
      : options.default;
  }

  return current;
}

function shouldReport<TAllowed extends string>(
  options: string | VariantOptions<TAllowed>
): boolean {
  return typeof options === 'object' ? options.trackExposure ?? true : true;
}
