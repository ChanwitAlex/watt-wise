import type { ModelParams, TreeNode } from "@/types/model-params";

export type FeatureRecord = Record<string, number>;

/** เดินต้นไม้ตัดสินใจ (กติกาเดียวกับ scikit-learn: ค่า ≤ threshold ไปทางซ้าย) */
export function evalTree(nodes: TreeNode[], features: FeatureRecord): number {
  let node = nodes[0];
  for (let guard = 0; guard < nodes.length; guard++) {
    if (node.leaf) return node.prob;
    const value = features[node.feature as string];
    if (value === undefined) throw new Error(`ขาดฟีเจอร์ ${node.feature}`);
    node = nodes[(value <= (node.threshold as number) ? node.left : node.right) as number];
  }
  throw new Error("โครงสร้างต้นไม้ไม่ถูกต้อง");
}

export function predictRisk(params: ModelParams, features: FeatureRecord): number {
  return evalTree(params.outage_tree.nodes, features);
}

export function predictDurationMin(params: ModelParams, features: FeatureRecord): number {
  const { features: names, coef, intercept, min_minutes } = params.duration;
  const raw = names.reduce((sum, name, i) => sum + coef[i] * (features[name] ?? 0), intercept);
  return Math.max(min_minutes, raw);
}

/** ดัชนีสภาพอากาศตามสูตรที่ฟิตจากข้อมูล (≈ ลม/120 + ฝน/80) จำกัดช่วง 0-1 */
export function severityOf(params: ModelParams, windKmh: number, rainMm: number): number {
  const { wind_coef, rain_coef, intercept } = params.severity;
  return Math.min(1, Math.max(0, wind_coef * windKmh + rain_coef * rainMm + intercept));
}

/** พยากรณ์ kWh จากค่าเฉลี่ยตามชั่วโมง/ประเภทวัน ปรับด้วยอุณหภูมิที่ต่างจากค่าปกติ */
export function predictUsageKwh(params: ModelParams, input: { isOffDay: boolean; hour: number; tempC: number }): number {
  const { usage_mean, temp_mean, temp_slope_kwh_per_c } = params.usage_profile;
  const row = input.isOffDay ? 1 : 0;
  const base = usage_mean[row][input.hour];
  const typicalTemp = temp_mean[row][input.hour];
  return Math.max(0, base + temp_slope_kwh_per_c * (input.tempC - typicalTemp));
}
