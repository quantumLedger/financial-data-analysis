/**
 * Retries an async function with exponential backoff and jitter.
 *
 * @param fn             - The async function to attempt.
 * @param maxRetries     - Total number of attempts (default 3).
 * @param initialDelay   - Base delay in ms before the first retry (default 1000).
 * @param maxDelay       - Upper cap on delay in ms (default 10000).
 * @param retryableErrors - If provided, only retry on these HTTP status codes.
 *                          4xx errors (except 429) are never retried regardless.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 10000,
  retryableErrors?: number[],
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const statusCode =
        error?.status || error?.response?.status || error?.statusCode;

      // Never retry on 4xx client errors except 429 (rate limit)
      if (
        statusCode &&
        statusCode >= 400 &&
        statusCode < 500 &&
        statusCode !== 429
      ) {
        throw error;
      }

      // If a specific allowlist is given, only retry those codes
      if (retryableErrors && statusCode && !retryableErrors.includes(statusCode)) {
        throw error;
      }

      // Don't sleep after the last attempt — just re-throw
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay,
      );

      console.log(
        `⚠️ Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}
