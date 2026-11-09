export interface ProcessOutputBuffers {
  stdout: string;
  stderr: string;
}

/** Default timeout for LanguageClient.start() / LSP initialize. */
export const DIGESTIF_START_TIMEOUT_MS = 30_000;

/**
 * Race a promise against a timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Format a LanguageClient / start error for logs.
 * DigestiF stderr is intentionally ignored here — it is log-only.
 */
export function preferDigestifError(
  languageClientError: unknown,
  _buffers?: ProcessOutputBuffers,
): string {
  void _buffers;
  if (languageClientError instanceof Error) {
    return languageClientError.message;
  }
  return String(languageClientError);
}
