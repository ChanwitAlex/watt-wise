"""ดึงสภาพอากาศรายชั่วโมงย้อนหลังจาก Open-Meteo (ไม่ต้องใช้ API key, CC BY 4.0)

ตัวอย่าง:
  python ml/fetch_weather.py --start 2025-01-01 --end 2026-09-30
  python ml/fetch_weather.py --lat 16.4419 --lon 102.8350 --start 2025-01-01 --end 2025-12-31 --out data/raw/weather_khonkaen.csv

ใช้ได้ฟรีเฉพาะงานที่ไม่ใช่เชิงพาณิชย์ และต้องให้เครดิต "Weather data by Open-Meteo.com"
ต้องรันบนเครื่องที่ต่ออินเทอร์เน็ตได้ (ผมรันตรวจจากฝั่งผมไม่ได้ จึงมีโหมด --check ให้ทดสอบ 2 วัน)
"""
import argparse
import csv
import json
import urllib.parse
import urllib.request
from pathlib import Path

URL = "https://archive-api.open-meteo.com/v1/archive"
VARS = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m"]
COLUMNS = ["timestamp", "temperature_c", "humidity_percent", "rainfall_mm", "wind_speed_kmh", "wind_gust_kmh"]
ROOT = Path(__file__).resolve().parent.parent


def fetch(lat, lon, start, end):
    query = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
        "hourly": ",".join(VARS), "timezone": "Asia/Bangkok", "wind_speed_unit": "kmh", "precipitation_unit": "mm",
    })
    with urllib.request.urlopen(f"{URL}?{query}", timeout=60) as resp:
        return json.load(resp)["hourly"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=16.4419)   # ขอนแก่น
    ap.add_argument("--lon", type=float, default=102.8350)
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--out", default=str(ROOT / "data" / "raw" / "weather_khonkaen.csv"))
    ap.add_argument("--check", action="store_true", help="ทดสอบดึง 2 วันแล้วพิมพ์ผล ไม่เขียนไฟล์")
    args = ap.parse_args()
    if args.check:
        args.end = args.start  # 1 วัน
    h = fetch(args.lat, args.lon, args.start, args.end)
    rows = [[t.replace("T", " ")] + [h[v][i] for v in VARS] for i, t in enumerate(h["time"])]
    if args.check:
        print(COLUMNS)
        for row in rows[:3]:
            print(row)
        print(f"ได้ {len(rows)} แถว")
        return
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        w.writerows(rows)
    print(f"เขียน {len(rows)} แถวลง {out}  (อย่าลืมให้เครดิต Open-Meteo.com)")


if __name__ == "__main__":
    main()
