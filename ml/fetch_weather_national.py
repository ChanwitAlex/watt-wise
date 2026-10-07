"""ดึงสภาพอากาศรายชั่วโมงย้อนหลังของ "ทั้ง 77 จังหวัด" จาก Open-Meteo (ข้อมูลจริง ไม่ใช่ข้อมูลจำลอง)

77 จังหวัด x 24 ชม. x 30 วัน ≈ 55,000 แถว (ตามที่ต้องการระดับ 40,000-50,000 แถว)

ตัวอย่าง:
  python ml/fetch_weather_national.py --start 2026-08-01 --end 2026-08-30
  python ml/fetch_weather_national.py --start 2026-08-01 --end 2026-08-30 --provinces ขอนแก่น,เชียงใหม่,ภูเก็ต

หมายเหตุ: นี่คือข้อมูลอากาศจริงเท่านั้น ไม่มีป้ายคำตอบ (ไฟดับ/การใช้ไฟ) ดูคำอธิบายใน README
ใช้ฟรีเฉพาะงานที่ไม่ใช่เชิงพาณิชย์ ต้องให้เครดิต "Weather data by Open-Meteo.com"
"""
import argparse
import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROVINCES = json.loads((ROOT / "lib" / "config" / "provinces.json").read_text(encoding="utf-8"))
VARS = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m"]
COLUMNS = ["province", "timestamp", "temperature_c", "humidity_percent", "rainfall_mm", "wind_speed_kmh", "wind_gust_kmh"]


def request_batch(base_url, batch, start, end, retries=4):
    query = urllib.parse.urlencode({
        "latitude": ",".join(str(p["lat"]) for p in batch), "longitude": ",".join(str(p["lon"]) for p in batch),
        "start_date": start, "end_date": end, "hourly": ",".join(VARS),
        "timezone": "Asia/Bangkok", "wind_speed_unit": "kmh", "precipitation_unit": "mm",
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(f"{base_url}?{query}", timeout=120) as resp:
                data = json.load(resp)
            return data if isinstance(data, list) else [data]
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:       # ขอเร็วเกินไป รอแล้วลองใหม่
                time.sleep(20 * (attempt + 1))
                continue
            raise
    raise RuntimeError("ดึงข้อมูลไม่สำเร็จ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--provinces", help="ชื่อจังหวัดคั่นด้วยจุลภาค (ไม่ใส่ = ทุกจังหวัด)")
    ap.add_argument("--batch", type=int, default=10, help="จำนวนจังหวัดต่อคำขอ")
    ap.add_argument("--pause", type=float, default=2.0, help="วินาทีที่พักระหว่างคำขอ")
    ap.add_argument("--base-url", default="https://archive-api.open-meteo.com/v1/archive")
    ap.add_argument("--out", default=str(ROOT / "data" / "raw" / "weather_national.csv"))
    args = ap.parse_args()

    chosen = PROVINCES
    if args.provinces:
        wanted = {n.strip() for n in args.provinces.split(",")}
        chosen = [p for p in PROVINCES if p["name"] in wanted]
        missing = wanted - {p["name"] for p in chosen}
        if missing:
            raise SystemExit(f"ไม่รู้จักจังหวัด: {', '.join(sorted(missing))}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        for i in range(0, len(chosen), args.batch):
            batch = chosen[i:i + args.batch]
            results = request_batch(args.base_url, batch, args.start, args.end)
            if len(results) != len(batch):
                raise SystemExit(f"จำนวนจุดที่ได้ ({len(results)}) ไม่ตรงกับที่ขอ ({len(batch)})")
            for prov, res in zip(batch, results):
                h = res["hourly"]
                for k, t in enumerate(h["time"]):
                    vals = [h[v][k] for v in VARS]
                    if any(v is None for v in vals):
                        continue
                    w.writerow([prov["name"], t.replace("T", " ")] + vals)
                    total += 1
            print(f"  {min(i + args.batch, len(chosen))}/{len(chosen)} จังหวัด")
            time.sleep(args.pause)
    print(f"เขียน {total:,} แถวลง {out}  (อย่าลืมให้เครดิต Open-Meteo.com)")


if __name__ == "__main__":
    main()
