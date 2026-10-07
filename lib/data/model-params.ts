import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ModelParams } from "@/types/model-params";

/** พารามิเตอร์โมเดลที่ ml/train.py ส่งออก ใช้คำนวณกับพยากรณ์อากาศบนเว็บ */
export const loadModelParams = cache(async (): Promise<ModelParams> => {
  const text = await readFile(path.join(process.cwd(), "data", "model_params.json"), "utf-8");
  return JSON.parse(text) as ModelParams;
});
