import { describe, expect, it } from "vitest";
import { mapInChunks, retry } from "@/lib/weather/retry";

const noSleep = async () => {};

describe("retry", () => {
  it("ล้ม 2 ครั้งแล้วสำเร็จในครั้งที่ 3", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls < 3) throw new Error("429");
      return "ok";
    }, 3, 10, noSleep);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
  it("ล้มทุกครั้งแล้วโยน error ล่าสุด และบอกลำดับครั้งให้ฟังก์ชัน", async () => {
    const attempts: number[] = [];
    await expect(retry(async (a) => { attempts.push(a); throw new Error(`fail ${a}`); }, 3, 10, noSleep)).rejects.toThrow("fail 2");
    expect(attempts).toEqual([0, 1, 2]);
  });
  it("รอนานขึ้นทุกครั้ง", async () => {
    const waits: number[] = [];
    await retry(async (a) => { if (a < 2) throw new Error("x"); return 1; }, 3, 100, async (ms) => { waits.push(ms); });
    expect(waits).toEqual([100, 200]);
  });
});

describe("mapInChunks", () => {
  it("ไม่ทำพร้อมกันเกินขนาดกลุ่ม ผลเรียงตามเดิม และรวมทั้งสำเร็จ/ล้ม", async () => {
    let running = 0;
    let maxRunning = 0;
    const results = await mapInChunks([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 4) throw new Error("boom");
      return n * 10;
    });
    expect(maxRunning).toBeLessThanOrEqual(3);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled", "rejected", "fulfilled", "fulfilled", "fulfilled"]);
    expect((results[6] as PromiseFulfilledResult<number>).value).toBe(70);
  });
});
