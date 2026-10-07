/** ดัชนีสภาพอากาศรายชั่วโมง (24 ช่อง) ของแต่ละจุดในแผนที่ความร้อน */
export interface ZoneSeries {
  id: string;
  name: string;
  values: (number | null)[];
}
