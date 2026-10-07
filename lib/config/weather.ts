/** Open-Meteo ให้พยากรณ์ล่วงหน้าได้สูงสุด 16 วัน ความแม่นลดลงมากหลังวันที่ ~7 */
export const FORECAST_DAYS = 16;
export const FORECAST_REVALIDATE_SEC = 1800;
export const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
export const ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive";
export const WEATHER_TIMEZONE = "Asia/Bangkok";
export const WEATHER_ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";

/** จุดรอบตัวผู้ใช้สำหรับแผนที่ความร้อน (องศา ≈ 28 กม.) */
export const ZONE_OFFSET_DEG = 0.25;
export const CENTER_ZONE_ID = "center";

export const HISTORY_REVALIDATE_SEC = 60 * 60 * 24;

/** ทำนายวันที่เลือก */
export const MAX_AHEAD_YEARS = 5;
/** วันเทียบเคียงจากสถิติ: ±N วันรอบวันที่เดียวกันของแต่ละปีย้อนหลัง */
export const ANALOG_YEARS = 10;
export const ANALOG_RADIUS_DAYS = 7;
/** ต้องดึงข้อมูลย้อนหลังสำเร็จอย่างน้อยกี่ปี จึงจะสรุปผลได้ */
export const ANALOG_MIN_YEARS = 5;
/** ข้อมูล archive ล่าช้าราว 5 วัน */
export const ARCHIVE_LAG_DAYS = 7;
/** เกณฑ์แปลง "สัดส่วนวันเทียบเคียงที่ติดเตือน" เป็นระดับโอกาส (ค่ากำหนดเอง ไม่ได้ฟิตจากข้อมูลจริง) */
export const CLIMATOLOGY_LEVELS = { moderate: 0.05, high: 0.2 } as const;
