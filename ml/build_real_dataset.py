"""สร้างชุดข้อมูลจริงรายชั่วโมงให้อยู่ในรูปแบบเดียวกับที่ ml/train.py อ่าน

ต้องมี 3 อย่าง (ดูแม่แบบใน data/templates/):
  1. สภาพอากาศ  data/raw/weather_khonkaen.csv   (สร้างด้วย ml/fetch_weather.py)
  2. บันทึกไฟดับ --outage-log  (เริ่ม, สิ้นสุด, วางแผนไว้หรือไม่) ที่คุณรวบรวมเอง/ขอจากการไฟฟ้า
  3. ค่ามิเตอร์ไฟ --meter     (เวลา, kWh) ของบ้าน/หอพักที่คุณวัดเอง (ไม่บังคับ ถ้าทำเฉพาะไฟดับ)

ใช้กับอากาศทั่วประเทศ (ml/fetch_weather_national.py) ได้ด้วย: ใส่ --weather data/raw/weather_national.csv
และ --covered-provinces ขอนแก่น,เชียงใหม่ (บันทึกไฟดับต้องมีคอลัมน์ province) แถวจะเรียงตามเวลา แล้วตามจังหวัด

ตัวอย่าง:
  python ml/build_real_dataset.py --log-start 2026-01-01 --log-end 2026-09-30 \\
      --outage-log data/raw/outage_log.csv --meter data/raw/meter.csv
  python ml/train.py --outage data/real/outage_hourly.csv --usage data/real/usage_hourly.csv

หลักการสำคัญ: --log-start/--log-end คือช่วงที่คุณ "เฝ้าบันทึก" จริง ชั่วโมงในช่วงนี้ที่ไม่มีเหตุการณ์ = ไม่ดับ
ถ้าไม่ได้เฝ้าบันทึกช่วงไหน อย่าใส่ในช่วงนั้น ไม่งั้นโมเดลจะเรียนว่า "ไม่ดับ" ทั้งที่จริงไม่รู้
นับเฉพาะไฟดับที่ไม่ได้วางแผนไว้ (planned = 0) เพราะไฟดับตามแผนทำนายจากอากาศไม่ได้
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TRUE = {"1", "true", "yes", "y", "ใช่", "วางแผน"}


def load_weather(path):
    w = pd.read_csv(path, encoding="utf-8-sig", parse_dates=["timestamp"])
    if "province" in w.columns:                # ไฟล์ทั่วประเทศ: เก็บจังหวัดเป็นคอลัมน์ ไม่ใช้เป็น index
        return w.sort_values(["timestamp", "province"]).set_index("timestamp")
    return w.set_index("timestamp").sort_index()


def holiday_flags(index):
    try:
        import holidays
        cal = holidays.Thailand(years=sorted({d.year for d in index}))
        return np.array([1 if d.date() in cal else 0 for d in index])
    except ImportError:
        print("คำเตือน: ไม่ได้ติดตั้งแพ็กเกจ holidays (pip install holidays) จึงใส่ is_holiday = 0 ทั้งหมด")
        return np.zeros(len(index), dtype=int)


def common_columns(frame):
    frame["hour"] = frame.index.hour
    frame["day_type"] = np.where(frame.index.dayofweek >= 5, "Weekend", "Weekday")
    frame["is_holiday"] = holiday_flags(frame.index)
    return frame


def build_outage_one(hours, log, start, end):
    hours = hours.loc[start:end + " 23:00"].copy()
    if hours.empty:
        raise SystemExit("ไม่มีข้อมูลสภาพอากาศในช่วงที่ระบุ ดึงให้ครอบคลุมช่วง --log-start/--log-end ก่อน")
    planned = log.get("planned", pd.Series(["0"] * len(log), index=log.index)).astype(str).str.strip().str.lower().isin(TRUE)
    log = log[~planned].copy()
    log["hour_start"] = log["start"].dt.floor("h")
    log["minutes"] = (log["end"] - log["start"]).dt.total_seconds() / 60
    per_hour = log.groupby("hour_start")["minutes"].sum()
    hours["outage_occurred"] = hours.index.isin(per_hour.index).astype(int)
    hours["outage_duration_min"] = per_hour.reindex(hours.index).fillna(0).round().astype(int)
    hours["weather_severity"] = (hours["wind_speed_kmh"] / 120 + hours["rainfall_mm"] / 80).round(3)
    return common_columns(hours)


def build_outage(weather, log_path, start, end, covered=None):
    log = pd.read_csv(log_path, encoding="utf-8-sig", parse_dates=["start", "end"])
    cols = ["hour", "day_type", "is_holiday", "wind_speed_kmh", "wind_gust_kmh", "rainfall_mm",
            "weather_severity", "outage_occurred", "outage_duration_min"]
    if "province" in weather.columns:
        if not covered:
            raise SystemExit("ไฟล์อากาศมีหลายจังหวัด ต้องระบุ --covered-provinces (จังหวัดที่เฝ้าบันทึกไฟดับจริง)")
        if "province" not in log.columns:
            raise SystemExit("บันทึกไฟดับต้องมีคอลัมน์ province เมื่อใช้ไฟล์อากาศหลายจังหวัด")
        parts = []
        for name in covered:
            hours = weather[weather["province"] == name]
            if hours.empty:
                raise SystemExit(f"ไม่มีข้อมูลอากาศของจังหวัด {name}")
            parts.append(build_outage_one(hours, log[log["province"] == name], start, end).assign(province=name))
        frame = pd.concat(parts).reset_index().sort_values(["timestamp", "province"])   # เรียงตามเวลา เพื่อให้แบ่ง 70/30 ตามเวลาได้ถูก
        out = frame[["timestamp", "province"] + cols].copy()
    else:
        out = build_outage_one(weather, log, start, end)[cols].reset_index()
        out = out[["timestamp"] + cols]
    out["timestamp"] = out["timestamp"].dt.strftime("%Y-%m-%d %H:%M")
    n_events = int(out["outage_occurred"].sum())
    print(f"ไฟดับ: {len(out):,} ชั่วโมง มีเหตุการณ์ {n_events} ชั่วโมง ({n_events / len(out):.1%})")
    if n_events < 30:
        print("คำเตือน: เหตุการณ์น้อยกว่า 30 ครั้ง ผลโมเดลจะแกว่งมาก ควรบันทึกเพิ่มหรือขยายช่วงเวลา")
    return out


def build_usage(weather, meter_path, kind):
    m = pd.read_csv(meter_path, encoding="utf-8-sig", parse_dates=["timestamp"]).set_index("timestamp").sort_index()
    kwh = m["kwh"]
    if kind == "cumulative":
        kwh = kwh.diff().clip(lower=0)             # ค่าที่อ่านจากมิเตอร์สะสม -> kWh ต่อช่วง
    hourly = kwh.resample("h").sum(min_count=1)
    df = weather.join(hourly.rename("electricity_usage_kwh"), how="inner").dropna(subset=["electricity_usage_kwh"])
    df = df.rename(columns={"temperature_c": "temperature_c", "humidity_percent": "humidity_percent"})
    df = common_columns(df)
    cols = ["hour", "day_type", "is_holiday", "temperature_c", "humidity_percent", "electricity_usage_kwh"]
    out = df[cols].reset_index()
    out["timestamp"] = out["timestamp"].dt.strftime("%Y-%m-%d %H:%M")
    print(f"การใช้ไฟ: {len(out)} ชั่วโมง ({len(out) / 24:.0f} วัน)")
    if len(out) < 24 * 60:
        print("คำเตือน: ข้อมูลน้อยกว่า 60 วัน ควรวัดอย่างน้อย 2-3 เดือนให้ครอบคลุมวันธรรมดา/วันหยุดและอากาศหลายแบบ")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weather", default=str(ROOT / "data" / "raw" / "weather_khonkaen.csv"))
    ap.add_argument("--outage-log")
    ap.add_argument("--log-start", help="วันแรกที่เฝ้าบันทึกไฟดับ YYYY-MM-DD")
    ap.add_argument("--log-end", help="วันสุดท้ายที่เฝ้าบันทึกไฟดับ YYYY-MM-DD")
    ap.add_argument("--covered-provinces", help="จังหวัดที่เฝ้าบันทึกไฟดับจริง คั่นด้วยจุลภาค (ใช้กับไฟล์อากาศทั่วประเทศ)")
    ap.add_argument("--meter")
    ap.add_argument("--meter-kind", choices=["interval", "cumulative"], default="interval")
    ap.add_argument("--out-dir", default=str(ROOT / "data" / "real"))
    args = ap.parse_args()
    weather = load_weather(args.weather)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.outage_log:
        if not (args.log_start and args.log_end):
            raise SystemExit("ต้องระบุ --log-start และ --log-end คู่กับ --outage-log")
        build_outage(weather, args.outage_log, args.log_start, args.log_end,
                     [n.strip() for n in args.covered_provinces.split(",")] if args.covered_provinces else None).to_csv(out_dir / "outage_hourly.csv", index=False)
    if args.meter:
        build_usage(weather, args.meter, args.meter_kind).to_csv(out_dir / "usage_hourly.csv", index=False)
    print(f"เขียนไฟล์ลง {out_dir}")


if __name__ == "__main__":
    main()
