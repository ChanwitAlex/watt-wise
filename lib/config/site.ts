export const SITE_NAME = "Watt Wise";

/** โมเดลเทรนด้วยข้อมูลสังเคราะห์/จำลอง (model_params.json: synthetic = true) */
export const DISCLAIMER_SYNTHETIC =
  "ต้นแบบเพื่อการเรียนรู้ ใช้ข้อมูลตัวอย่าง/จำลอง ไม่ใช่การพยากรณ์ไฟดับจริงในประเทศไทย ข้อความแนะนำและค่ารายโซนไม่ได้มาจากโมเดล";

/** โมเดลเทรนด้วยข้อมูลไฟดับจริง: ยังต้องเตือนว่าเป็นการประเมินจากอากาศ ไม่ใช่คำยืนยัน */
export const DISCLAIMER_REAL =
  "ผลเป็นการประเมินความเสี่ยงจากสภาพอากาศและโมเดลที่เทรนด้วยข้อมูลไฟดับที่บันทึกไว้ ไม่ใช่คำยืนยันว่าไฟจะดับ ข้อความแนะนำและค่ารายโซนไม่ได้มาจากโมเดล";

export const SESSION_COOKIE = "ww_session";
export const VIEW_COOKIE = "ww_view";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export const VIEWS = ["general", "manager"] as const;
export type ViewMode = (typeof VIEWS)[number];
export const DEFAULT_VIEW: ViewMode = "general";
export const DEMO_VIEW: ViewMode = "manager";

export const PASSWORD_MIN_LENGTH = 8;
