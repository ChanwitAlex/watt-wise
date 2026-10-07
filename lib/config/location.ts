export const LOCATION_COOKIE = "ww_loc";
export const LOCATION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;
export const DEFAULT_PROVINCE = "กรุงเทพมหานคร";
/** ระยะไกลสุดจากศูนย์กลางจังหวัดที่ยังถือว่าอยู่ในประเทศไทย (กม.) */
export const MAX_DISTANCE_TO_PROVINCE_KM = 150;
export const THAILAND_BOUNDS = { minLat: 5.5, maxLat: 20.6, minLon: 97.3, maxLon: 105.7 } as const;
