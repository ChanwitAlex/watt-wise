/** ลองใหม่เมื่อล้มเหลว (เช่น ถูกจำกัดอัตราเรียก หรือเครือข่ายสะดุด) รอนานขึ้นทุกครั้ง */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  tries: number,
  baseDelayMs: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      last = error;
      if (attempt < tries - 1) await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw last;
}

/** ทำทีละกลุ่ม (ไม่ยิงพร้อมกันทั้งหมด) ผลลัพธ์เรียงตามลำดับเดิม */
export async function mapInChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return out;
}
