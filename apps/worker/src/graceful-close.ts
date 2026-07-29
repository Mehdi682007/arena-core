export async function closeWithTimeout(
  close: () => Promise<void>,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Worker shutdown exceeded configured timeout.'));
    }, timeoutMs);
    timer.unref();
  });

  try {
    await Promise.race([close(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
