function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, {once: true});
  });
}

// Only read requests: bounded retries, cancelled when the selected filters change.
export async function fetchRead(url: string, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, {signal, cache: 'no-store', headers: {Accept: 'application/json'}});
      if (![502, 503, 504].includes(response.status) || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) {
      if (signal.aborted || !(error instanceof TypeError) || attempt === 2) throw error;
    }
    await wait(500 * (attempt + 1), signal);
  }
}
