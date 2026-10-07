export interface TreeNode {
  leaf: boolean;
  feature: string | null;
  threshold: number | null;
  left: number | null;
  right: number | null;
  prob: number; // สัดส่วนเหตุการณ์ในโหนดนั้น (ใช้เป็นความน่าจะเป็นที่ใบ)
}

export interface ModelParams {
  outage_tree: { features: string[]; nodes: TreeNode[] };
  duration: { features: string[]; coef: number[]; intercept: number; min_minutes: number };
  severity: { wind_coef: number; rain_coef: number; intercept: number; r2: number };
  usage_profile: { usage_mean: number[][]; temp_mean: number[][]; temp_slope_kwh_per_c: number };
  trained_on: { outage: string; usage: string };
  /** true = เทรนด้วยข้อมูลสังเคราะห์/จำลอง (ml/train.py --synthetic) เว็บใช้เลือกข้อความเตือน */
  synthetic: boolean;
}
