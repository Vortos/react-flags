export interface RetryOptions {
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Headers for a request, either fixed or resolved fresh at request time.
 *
 * Prefer the function form for anything credential-bearing. A fixed object is a
 * snapshot: a provider polling on an interval keeps sending the token it was given
 * at mount, and once that token expires every poll 401s until the page reloads.
 * A resolver is asked on each attempt, so it always sees the host's current token.
 */
export type HeadersInput =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

/**
 * Called when a request comes back unauthorized. Renew the credentials (refresh the
 * token, re-authenticate) and resolve `true` to have the request retried once with
 * freshly resolved headers; resolve `false` if the credentials cannot be renewed, and
 * the original error surfaces to the caller.
 *
 * Asked at most once per request, so returning `true` without actually renewing costs
 * one wasted attempt rather than an infinite loop.
 */
export type UnauthorizedHandler = (
  error: HttpError
) => boolean | Promise<boolean>;

/** A non-2xx response. Carries the status so callers can branch on it. */
export class HttpError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(endpoint: string, status: number) {
    super(`${endpoint} returned ${status}`);
    this.name = 'HttpError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

export interface FetchJsonOptions extends RetryOptions {
  endpoint: string;
  headers: HeadersInput;
  signal: AbortSignal;
  onUnauthorized?: UnauthorizedHandler;
}

/** Statuses that mean "your credentials are the problem" rather than "you may not do this". */
const UNAUTHORIZED_STATUSES = new Set([401, 403]);

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

/** Resolves either form of `HeadersInput` to a plain header object. */
export async function resolveHeaders(
  headers: HeadersInput
): Promise<Record<string, string>> {
  return typeof headers === 'function' ? await headers() : headers;
}

/**
 * A key that changes whenever fixed headers change, and stays constant for resolver
 * functions — a resolver's identity says nothing about what it will return, so
 * re-running effects on it would just churn.
 */
export function headersIdentity(headers: HeadersInput): string {
  return typeof headers === 'function' ? '[resolver]' : stableSerialize(headers);
}

export async function fetchJson<T>({
  endpoint,
  headers,
  signal,
  retries = 0,
  retryDelayMs = 500,
  onUnauthorized,
}: FetchJsonOptions): Promise<T> {
  let attempt = 0;
  let renewalAttempted = false;

  while (true) {
    try {
      const resolved = await resolveHeaders(headers);
      const response = await fetch(endpoint, { headers: resolved, signal });

      if (!response.ok) {
        throw new HttpError(endpoint, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      // Expired credentials are not a transient failure — retrying with the same token
      // would fail identically. Give the host one chance to renew, then try again with
      // whatever the resolver now returns. This does not consume a retry attempt.
      if (
        onUnauthorized &&
        !renewalAttempted &&
        error instanceof HttpError &&
        UNAUTHORIZED_STATUSES.has(error.status)
      ) {
        renewalAttempted = true;

        let renewed = false;
        try {
          renewed = await onUnauthorized(error);
        } catch {
          // A handler that throws is a handler that could not renew.
          renewed = false;
        }

        if (signal.aborted) {
          throw error;
        }

        if (renewed) {
          continue;
        }
      }

      if (attempt >= retries) {
        throw error;
      }

      await delay(retryDelayMs * (attempt + 1), signal);
      attempt += 1;
    }
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);

    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      },
      { once: true }
    );
  });
}
