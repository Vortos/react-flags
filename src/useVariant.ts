import { useEffect } from 'react';
import { useFlagContext } from './context';
import type { VariantOptions } from './types';

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
  const defaultVariant =
    typeof options === 'string' ? options : options.default;
  const current = state.getVariant(name, defaultVariant);

  if (typeof options === 'object' && options.allowed) {
    return options.allowed.includes(current as TAllowed)
      ? current
      : defaultVariant;
  }

  return current;
}

export function useVariantState<TAllowed extends string = string>(
  name: string,
  options: string | VariantOptions<TAllowed> = 'control'
) {
  const state = useFlagContext();
  const defaultVariant =
    typeof options === 'string' ? options : options.default;
  const current = state.getVariant(name, defaultVariant);
  const variant =
    typeof options === 'object' && options.allowed
      ? options.allowed.includes(current as TAllowed)
        ? current
        : defaultVariant
      : current;
  const shouldTrack =
    typeof options === 'object' ? options.trackExposure === true : false;

  useEffect(() => {
    if (!state.loading && shouldTrack) {
      state.trackExposure(name, variant);
    }
  }, [name, shouldTrack, state, variant]);

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
