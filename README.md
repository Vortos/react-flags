# @vortos/flags

React feature flag provider, hooks, variants, payloads, and exposure tracking for Vortos applications.

The backend evaluates rollout rules. This package keeps evaluated frontend flag state local, observable, refreshable, and easy to consume from React components.

```txt
Backend evaluates.
Frontend remembers.
Components ask locally.
Backend can change rollout without redeploying frontend.
```

## Install

```bash
npm install @vortos/flags
```

React is a peer dependency:

```txt
react >= 18
```

## Basic Setup

Wrap your app once near the router:

```tsx
import { FeatureFlagProvider } from '@vortos/flags';

export function App() {
  return (
    <FeatureFlagProvider endpoint="/api/flags">
      <Router />
    </FeatureFlagProvider>
  );
}
```

The endpoint can be any route. `/api/flags` is only the default Vortos convention.

```tsx
<FeatureFlagProvider endpoint="/internal/frontend/flags">
  <App />
</FeatureFlagProvider>
```

## Response Contract

Minimum response:

```json
{
  "flags": ["new-dashboard", "analytics-tab"]
}
```

With variants:

```json
{
  "flags": ["new-checkout"],
  "variants": {
    "checkout-layout": "variant-b"
  }
}
```

With remote configuration payloads:

```json
{
  "flags": ["new-dashboard"],
  "variants": {
    "checkout-layout": "variant-b"
  },
  "payloads": {
    "new-dashboard": {
      "maxWidgets": 8,
      "layout": "compact"
    }
  },
  "version": "flags_2026_05_04_001"
}
```

Use booleans for rollout, variants for experiments, and payloads for small public configuration. Do not put secrets in payloads because they are delivered to the browser.

## Simple Hooks

```tsx
import { FeatureFlag, useFlag, useVariant } from '@vortos/flags';

const enabled = useFlag('new-dashboard');
const variant = useVariant('checkout-layout', 'control');
```

Render with a component:

```tsx
<FeatureFlag name="new-checkout" fallback={<OldCheckout />}>
  <NewCheckout />
</FeatureFlag>
```

## Stateful Hooks

Use `useFlagState()` when a screen needs loading, stale, refresh, or error state:

```tsx
import { useFlagState } from '@vortos/flags';

function DashboardEntry() {
  const { enabled, loading, error, stale, refetch } = useFlagState('new-dashboard');

  if (loading) return <DashboardSkeleton />;
  if (error) return <RetryPanel error={error} onRetry={refetch} />;

  return enabled ? <NewDashboard stale={stale} /> : <OldDashboard />;
}
```

Use `useFlagContext()` for global diagnostics:

```tsx
import { useFlagContext } from '@vortos/flags';

function FlagDebugPanel() {
  const { flags, variants, payloads, version, refreshing, refetch } = useFlagContext();

  return (
    <button disabled={refreshing} onClick={() => refetch()}>
      Refresh flags
    </button>
  );
}
```

## Payloads

```tsx
import { useFlagPayload } from '@vortos/flags';

type DashboardPayload = {
  maxWidgets: number;
  layout: 'compact' | 'comfortable';
};

const config = useFlagPayload<DashboardPayload>('new-dashboard', {
  maxWidgets: 4,
  layout: 'comfortable',
});

return <Dashboard maxWidgets={config.maxWidgets} layout={config.layout} />;
```

## Variants

```tsx
const variant = useVariant('checkout-layout', 'control');

if (variant === 'variant-b') return <CheckoutB />;
return <CheckoutA />;
```

Validate allowed variants:

```tsx
const variant = useVariant('checkout-layout', {
  default: 'control',
  allowed: ['control', 'variant-a', 'variant-b'],
});
```

For state plus exposure tracking:

```tsx
const { variant, loading, error, trackExposure } = useVariantState(
  'checkout-layout',
  {
    default: 'control',
    allowed: ['control', 'variant-a', 'variant-b'],
    trackExposure: true,
  }
);
```

## Targeting Context

Pass targeting data to the backend evaluator:

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  context={{
    userId,
    tenantId,
    role,
    country,
    plan: 'enterprise',
    attributes: {
      federationId,
      betaGroup: 'coaches',
    },
  }}
>
  <App />
</FeatureFlagProvider>
```

The provider sends context in `X-Vortos-Flag-Context` by default. You can change the header:

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  context={flagContext}
  contextHeaderName="X-App-Flag-Context"
>
  <App />
</FeatureFlagProvider>
```

## Exposure Tracking

Use a callback:

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  onExposure={(event) => {
    analytics.track('flag.exposure', event);
  }}
>
  <App />
</FeatureFlagProvider>
```

Or post exposure events to an endpoint:

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  exposureEndpoint="/api/flags/exposures"
>
  <App />
</FeatureFlagProvider>
```

Exposure events are deduplicated per flag and variant during a provider lifecycle.

## Auth Headers

Headers are part of the provider's refetch identity. If a token changes, flags refetch.
The provider does not manage login, token storage, or token refresh. Read the access token from your app's auth/session layer and pass it as a header.

For a Vortos JWT login response, the access token is returned as `token.access_token`:

```tsx
const loginResponse = await login(email, password);
const accessToken = loginResponse.token.access_token;
```

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  headers={{ Authorization: `Bearer ${accessToken}` }}
>
  <Router />
</FeatureFlagProvider>
```

### Tokens That Expire

A header object is a snapshot. The provider polls on its own schedule, so if that object
holds a short-lived access token, every poll after the token's expiry returns 401 — and
keeps returning 401 until something re-renders the provider with a new one. Pass a
function instead and the provider resolves it on each attempt, picking up whatever your
auth layer currently holds:

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  headers={() => ({ Authorization: `Bearer ${getAccessToken()}` })}
  onUnauthorized={() => silentRefresh()}
  refreshInterval={300_000}
>
  <Router />
</FeatureFlagProvider>
```

`onUnauthorized` is the backstop for the narrow case where a token expires between two
polls: on a 401 or 403 the provider calls it once, and if it resolves `true` retries the
request with freshly resolved headers. Return `false` when the credentials cannot be
renewed and the original error surfaces as normal. It is asked at most once per request,
so a handler that returns `true` without renewing costs one wasted attempt, not a loop.

Errors reaching `onError` are `HttpError` instances carrying `status` whenever the server
responded, so callers can branch on the status rather than parsing a message.

## Refreshing, Stale State, And Cache

```tsx
<FeatureFlagProvider
  endpoint="/api/flags"
  headers={{ Authorization: `Bearer ${accessToken}` }}
  context={{ userId, tenantId, role, plan }}
  staleTime={30_000}
  refreshInterval={60_000}
  refetchOnWindowFocus
  retries={2}
  retryDelayMs={500}
  persist
  cacheKey={`flags:${userId}:${tenantId}`}
>
  <Router />
</FeatureFlagProvider>
```

Use tenant-aware cache keys:

```txt
flags:${userId}:${tenantId}
```

This prevents one user's cached flags from appearing after another user logs in on the same browser.

## SSR Initial Data

```tsx
<FeatureFlagProvider
  initialFlags={serverFlags}
  initialVariants={serverVariants}
  initialPayloads={serverPayloads}
  initialVersion={serverFlagVersion}
>
  <App />
</FeatureFlagProvider>
```

The provider still refetches on the client after mount.

## Permissions Versus Flags

Feature flags answer: should this product feature be visible or enabled right now?

Permissions answer: is this user allowed to perform this action?

Use both when a feature requires rollout and authorization:

```tsx
import { useFlag } from '@vortos/flags';
import { usePermission } from '@vortos/permissions';

const rolledOut = useFlag('analytics-tab');
const allowed = usePermission('analytics.view.any');

return rolledOut && allowed ? <AnalyticsNav /> : null;
```
