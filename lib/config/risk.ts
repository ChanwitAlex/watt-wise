/** เกณฑ์ระดับความเสี่ยง (ความน่าจะเป็น 0-1) ต้องตรงกับ WARNING_THRESHOLD ใน ml/train.py */
export const RISK_THRESHOLDS = { warning: 0.35, high: 0.6 } as const;

/** เกณฑ์กฎ rule-based: ดัชนีสภาพอากาศ (severity) ตั้งแต่ค่านี้ขึ้นไปให้เตือน */
export const RULE_SEVERITY_THRESHOLD = 0.35;
