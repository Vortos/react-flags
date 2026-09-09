import { useEffect } from 'react';
import type { FlagContextValue } from './types';

/**
 * How a boolean flag's evaluated value is reported as a variant.
 *
 * Matches what the server reports for its own evaluations, so a flag read in the browser and
 * the same flag read in a request handler produce one vocabulary rather than two. Analytics
 * backends coerce these back to real booleans at their own mapping edge; keeping the wire
 * value a string means the exposure endpoint has one shape for boolean and multivariate flags
 * alike.
 */
export function booleanVariant(enabled: boolean): 'true' | 'false' {
  return enabled ? 'true' : 'false';
}

/**
 * Reports an exposure once the flag state has actually loaded.
 *
 * Deliberately in an effect rather than during render: reporting from a render body is a side
 * effect React is free to run twice (and does, under StrictMode), and it would fire against
 * the loading state's default value before the real one has arrived — attributing the user to
 * the wrong variant.
 *
 * The provider dedupes by `(name, variant)`, so this is safe to call on every render and safe
 * to call from several components reading the same flag.
 */
export function useReportExposure(
  state: FlagContextValue,
  name: string,
  variant: string | undefined,
  shouldReport: boolean
): void {
  const { loading, trackExposure } = state;

  useEffect(() => {
    // While loading, `isEnabled()` answers with the default rather than the real value; an
    // exposure recorded then is a measurement of our own placeholder.
    if (!shouldReport || loading || name === '') {
      return;
    }

    trackExposure(name, variant);
  }, [shouldReport, loading, name, variant, trackExposure]);
}
