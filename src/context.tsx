import { createContext, useContext } from 'react';
import type { FlagContextValue } from './types';

const noopRefetch = async () => undefined;

export const FlagContext = createContext<FlagContextValue>({
  flags: [],
  variants: {},
  payloads: {},
  version: null,
  loading: true,
  refreshing: false,
  stale: true,
  error: null,
  lastUpdatedAt: null,
  refetch: noopRefetch,
  isEnabled: () => false,
  getVariant: (_name: string, defaultVariant = 'control') => defaultVariant,
  getPayload: <T,>(_name: string, defaultPayload?: T) => defaultPayload,
  trackExposure: () => undefined,
});

export function useFlagContext(): FlagContextValue {
  return useContext(FlagContext);
}
