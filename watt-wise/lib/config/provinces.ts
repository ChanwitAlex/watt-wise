import provinceData from "./provinces.json";

export interface Province {
  name: string;
  lat: number;
  lon: number;
}

/** 77 จังหวัด พิกัดโดยประมาณของตัวเมือง (ไฟล์เดียวกับที่สคริปต์ Python ใช้) */
export const PROVINCES: readonly Province[] = provinceData;
