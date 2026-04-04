import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

// Custom status used internally to signal a Koyeb cold start response.
// Koyeb returns 200 OK with an HTML holding page while the service wakes up,
// causing a JSON parse error. We normalize this to a distinct status code.
export const COLD_START_STATUS = -1;

// Exponential backoff delays for cold start retries (ms).
// Total max wait ~26s, covering Koyeb's observed cold start range of 5-15s.
export const COLD_START_DELAYS_MS = [3000, 5000, 8000, 10000];

function normalizeError(err: HttpErrorResponse) {
  if (err.status === 200) {
    return throwError(() => new HttpErrorResponse({
      error: err.error,
      headers: err.headers,
      status: COLD_START_STATUS,
      statusText: 'Service Starting',
      url: err.url ?? undefined,
    }));
  }
  return throwError(() => err);
}

export const serverErrorInterceptor: HttpInterceptorFn = (req, next) => {
  // Only apply cold start retry on the login endpoint.
  // Background requests (e.g. auth/refresh on app init) should fail fast.
  if (!req.url.includes('/auth/login')) {
    return next(req).pipe(catchError(normalizeError));
  }

  return next(req).pipe(
    retry({
      count: COLD_START_DELAYS_MS.length,
      delay: (err: unknown, retryCount: number) => {
        if (err instanceof HttpErrorResponse && err.status === 200) {
          return timer(COLD_START_DELAYS_MS[retryCount - 1] ?? COLD_START_DELAYS_MS.at(-1)!);
        }
        return throwError(() => err);
      },
    }),
    catchError(normalizeError),
  );
};
