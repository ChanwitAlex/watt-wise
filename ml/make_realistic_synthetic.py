"""สร้างข้อมูล "จำลอง" ที่สมจริงขึ้น สำหรับทดสอบ/สาธิตระบบ Watt Wise

!! นี่ไม่ใช่ข้อมูลจริง และห้ามอ้างว่าเป็นสถิติของ กฟผ./กฟภ./กฟน. !!
ต้องระบุในรายงานว่าเป็นข้อมูลจำลองที่สร้างด้วยสคริปต์นี้ ตัวเลขความแม่นวัดกับ "โลกที่สคริปต์นี้ตั้งขึ้น"
ไม่ได้บอกว่าจะแม่นกับไฟดับจริง (ถ้าไม่ระบุ ถือเป็นการนำเสนอข้อมูลเท็จ)

ต่างจาก make_synthetic.py (ที่ขยายจากตัวอย่าง 720 แถว) ตรงที่ตั้งโครงสร้างตามเหตุผลทางกายภาพ:
- อากาศแบบภาคตะวันออกเฉียงเหนือของไทย: อุณหภูมิตามฤดู (ร้อน/ฝน/หนาว) + วัฏจักรรายวัน
- ฝนเป็นพายุฝนฟ้าคะนองช่วงบ่าย-เย็น (เดือนพ.ค.-ต.ค. มากสุด) มีลมกระโชกนำหน้าฝน หางหนักบางลูกรุนแรง
- ไฟดับระดับ "พื้นที่" (หลายฟีดเดอร์รวมกัน): ความน่าจะเป็นขึ้นกับลมกระโชก ฝน ฟ้าผ่าโดยประมาณ
  โหลดกริดช่วงเย็น และมีสาเหตุพื้นฐานที่ไม่เกี่ยวกับอากาศ (อุปกรณ์ขัดข้อง) จึงมีสัญญาณรบกวนเหมือนของจริง
- ระยะเวลาไฟดับ: log-normal ยาวขึ้นเมื่อพายุแรงและช่วงกลางคืน (ทีมซ่อมช้ากว่า)
- การใช้ไฟครัวเรือน: โปรไฟล์รายชั่วโมง วันธรรมดา/วันหยุด + แอร์ตามอุณหภูมิ + วันที่คนไม่อยู่บ้าน
  และใช้ไฟลดลงในชั่วโมงที่ไฟดับ

รูปแบบคอลัมน์ตรงกับที่ ml/train.py และเว็บอ่าน (is_holiday = 0 ทั้งหมด เพราะ lib/config/holidays.ts ว่างอยู่)

  python ml/make_realistic_synthetic.py                      # 730 วัน (2 ปี) ไฟดับ ~2.2% ของชั่วโมง
  python ml/make_realistic_synthetic.py --days 1095 --seed 7 --rate 0.03
  python ml/train.py --outage outage_sim_th.csv --usage usage_sim_th.csv --synthetic
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# ค่าเฉลี่ยรายเดือน (ม.ค.-ธ.ค.) แบบภาคอีสาน: อุณหภูมิเฉลี่ยรายวัน °C และความน่าจะเป็นวันฝนตก
MONTH_TEMP = np.array([24.5, 27.0, 29.5, 30.8, 29.8, 28.9, 28.3, 27.9, 27.6, 27.0, 25.5, 23.8])
MONTH_WET = np.array([0.03, 0.05, 0.12, 0.22, 0.38, 0.45, 0.50, 0.55, 0.55, 0.30, 0.08, 0.03])
MONTH_MID_DOY = np.array([15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349])


def circ_interp(doy, table):
    x = np.concatenate([[MONTH_MID_DOY[-1] - 365], MONTH_MID_DOY, [MONTH_MID_DOY[0] + 365]])
    y = np.concatenate([[table[-1]], table, [table[0]]])
    return np.interp(doy, x, y)


def gauss(h, mu, sd):
    d = np.minimum(np.abs(h - mu), 24 - np.abs(h - mu))
    return np.exp(-0.5 * (d / sd) ** 2)


def simulate_weather(rng, idx):
    n, days = len(idx), len(idx) // 24
    hour, doy = idx.hour.values, idx.dayofyear.values
    day_doy = doy[::24]

    # --- วันฝนตก: Markov รายวัน (วันก่อนหน้าฝนตกเพิ่มโอกาส)
    p_wet = circ_interp(day_doy, MONTH_WET)
    wet_day = np.zeros(days, dtype=bool)
    for d in range(days):
        p = p_wet[d] * (1.5 if d and wet_day[d - 1] else 0.85)
        wet_day[d] = rng.random() < min(p, 0.92)

    rain = np.zeros(n)
    storm_wind = np.zeros(n)
    storm_flag = np.zeros(n)
    for d in np.flatnonzero(wet_day):
        for _ in range(1 + (rng.random() < 0.25)):
            start = int(rng.normal(16.5, 2.5)) if rng.random() < 0.7 else int(rng.integers(0, 24))
            start = int(np.clip(start, 0, 23))
            length = int(np.clip(1 + rng.poisson(2.0), 1, 7))
            peak = float(rng.lognormal(1.2, 0.8))              # มัธยฐาน ~3.3 มม./ชม. หางหนัก
            severe = rng.random() < 0.06
            if severe:
                peak *= rng.uniform(2.5, 4.0)
            for k in range(length):
                i = d * 24 + start + k
                if i >= n:
                    break
                w = np.sin(np.pi * (k + 0.5) / length) ** 0.8     # ฝนหนักตรงกลางพายุ
                rain[i] += peak * w * rng.lognormal(0, 0.35)
                front = 1.35 if k == 0 else 1.0                   # ลมกระโชกนำหน้าฝน
                storm_wind[i] = max(storm_wind[i], (7 + 5.0 * peak ** 0.75) * (0.55 + 0.45 * w) * front * (1.25 if severe else 1.0))
                storm_flag[i] = 1
    rain = np.where(rain < 0.15, 0.0, np.minimum(rain, 80)).round(1)

    # --- ลมพื้นฐาน + พายุ
    bg = (5.5 + 4.0 * gauss(hour, 14.5, 3.5)) * rng.lognormal(0, 0.45, n)
    wind = np.clip(bg + storm_wind * rng.uniform(0.85, 1.15, n), 0.5, 70)
    gust_ratio = 1.3 + 0.25 * rng.random(n) + storm_flag * 0.35 * rng.random(n)
    gust = np.clip(np.maximum(wind * gust_ratio, wind + 1), 1, 115)

    # --- อุณหภูมิ: ฤดูกาล + วัฏจักรรายวัน + ความต่างระหว่างวัน (AR1) ลดลงเมื่อฝนตก
    dry = 1 - circ_interp(day_doy, MONTH_WET) / 0.6
    amp = np.repeat(4.2 + 3.0 * dry, 24)
    shape = 0.85 * np.cos(2 * np.pi * (hour - 14.5) / 24) + 0.15 * np.cos(4 * np.pi * (hour - 8.5) / 24)
    off = np.zeros(days)
    for d in range(1, days):
        off[d] = 0.7 * off[d - 1] + rng.normal(0, 1.3 * np.sqrt(1 - 0.49))
    rain_cool = np.convolve((rain > 0.5).astype(float), [1, 1, 0.6], mode="full")[:n]
    temp = circ_interp(doy, MONTH_TEMP) + amp * shape + np.repeat(off, 24) - 3.0 * np.minimum(rain_cool, 1) + rng.normal(0, 0.5, n)
    hum = np.clip(95 - 2.6 * (temp - 22) + 14 * (rain_cool > 0) + 4 * (circ_interp(doy, MONTH_WET) / 0.55) + rng.normal(0, 4.5, n), 28, 100)
    return {"rain": rain, "wind": wind.round(1), "gust": gust.round(1), "temp": temp.round(1), "hum": hum.round(1)}


def solve_intercept(z_no_b0, target_rate):
    lo, hi = -20.0, 5.0
    for _ in range(60):
        mid = (lo + hi) / 2
        rate = (1 / (1 + np.exp(-(mid + z_no_b0)))).mean()
        lo, hi = (mid, hi) if rate < target_rate else (lo, mid)
    return (lo + hi) / 2


def simulate(days, start, seed, rate):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, periods=days * 24, freq="h")
    n = len(idx)
    hour = idx.hour.values
    weekend = (idx.dayofweek >= 5).astype(int)
    w = simulate_weather(rng, idx)
    rain, wind, gust, temp, hum = w["rain"], w["wind"], w["gust"], w["temp"], w["hum"]
    sev = (wind / 120 + rain / 80).round(3)

    # --- โหลดกริด % (หนักช่วงเย็นและวันร้อน)
    grid = np.clip(52 + 22 * gauss(hour, 19.5, 2.6) + 7 * gauss(hour, 11, 2.5) + 1.6 * np.maximum(temp - 27, 0)
                   - 5 * weekend + rng.normal(0, 3.5, n), 20, 98)

    # --- ไฟดับ (ไม่ได้วางแผนไว้)
    lightning = ((rain > 2) & (gust > 40)).astype(float)
    z = (0.055 * np.maximum(gust - 28, 0) + 0.16 * np.minimum(rain, 30) + 1.6 * lightning
         + 0.12 * np.maximum(grid - 78, 0) + 0.25 * gauss(hour, 19.5, 2.5))
    z = z + rng.normal(0, 0.6, n)                              # ปัจจัยที่ไม่ได้วัด (ต้นไม้ล้ม รถชน ฯลฯ)
    prob = 1 / (1 + np.exp(-(solve_intercept(z, rate) + z)))
    occurred = (rng.random(n) < prob).astype(int)

    # ระยะเวลา (นาที): log-normal ยาวขึ้นตามพายุและกลางคืน
    night = ((hour >= 22) | (hour < 5)).astype(float)
    mu = np.log(24) + 2.4 * np.minimum(sev, 0.9) + 0.25 * night + 0.35 * lightning
    dur = np.clip(np.exp(rng.normal(mu, 0.55)), 4, 420)
    duration = np.where(occurred == 1, dur, 0).round().astype(int)

    # --- การใช้ไฟครัวเรือน (kWh/ชม.)
    base = (0.42 + 0.30 * gauss(hour, 7, 1.3) + 0.95 * gauss(hour, 20, 2.3)
            + np.where(weekend == 1, 0.45, 0.12) * gauss(hour, 12.5, 2.5))
    occupied = np.where((hour >= 18) | (hour <= 6), 1.0, np.where(weekend == 1, 0.7, 0.35))
    ac = 0.085 * np.maximum(temp - 26, 0) * occupied
    day_factor = np.repeat(np.where(rng.random(days) < 0.05, 0.55, 1.0) * np.exp(rng.normal(0, 0.07, days)), 24)
    usage = (base + ac) * day_factor * rng.lognormal(0, 0.12, n)
    usage = usage * (1 - np.minimum(duration, 60) / 60)        # ไฟดับ = ใช้ไฟลดลง
    usage = np.clip(usage, 0.0, None)

    stamp = idx.strftime("%Y-%m-%d %H:%M")
    day_type = np.where(weekend == 1, "Weekend", "Weekday")
    outage = pd.DataFrame({
        "timestamp": stamp, "hour": hour, "day_type": day_type, "is_holiday": 0,
        "wind_speed_kmh": wind, "wind_gust_kmh": gust, "rainfall_mm": rain, "weather_severity": sev,
        "equipment_age_years": 4.7, "grid_load_percent": grid.round(1),
        "outage_occurred": occurred, "outage_duration_min": duration,
    })
    usage_df = pd.DataFrame({
        "timestamp": stamp, "hour": hour, "day_type": day_type, "is_holiday": 0,
        "temperature_c": temp, "humidity_percent": hum, "electricity_usage_kwh": usage.round(3),
    })
    return outage, usage_df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--start", default="2024-10-01")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--rate", type=float, default=0.022, help="สัดส่วนชั่วโมงที่มีไฟดับ (ระดับพื้นที่)")
    args = ap.parse_args()
    o, u = simulate(args.days, args.start, args.seed, args.rate)
    o.to_csv(RAW / "outage_sim_th.csv", index=False)
    u.to_csv(RAW / "usage_sim_th.csv", index=False)
    ev = o[o["outage_occurred"] == 1]
    print(f"แถว {len(o):,} ({args.days} วัน) ไฟดับ {len(ev)} ชั่วโมง ({len(ev) / len(o):.2%})")
    print(f"ระยะเวลา: มัธยฐาน {ev['outage_duration_min'].median():.0f} นาที, เฉลี่ย {ev['outage_duration_min'].mean():.0f}, p90 {ev['outage_duration_min'].quantile(.9):.0f}")
    print(f"ลม {o['wind_speed_kmh'].mean():.1f} กระโชกสูงสุด {o['wind_gust_kmh'].max():.0f} กม./ชม. ฝนรวม/ปี {o['rainfall_mm'].sum() / (args.days / 365):.0f} มม.")
    print(f"อุณหภูมิ {u['temperature_c'].min():.1f}-{u['temperature_c'].max():.1f} °C ใช้ไฟเฉลี่ย {u['electricity_usage_kwh'].sum() / args.days:.1f} kWh/วัน")
    print("เขียน data/raw/outage_sim_th.csv และ usage_sim_th.csv (ข้อมูลจำลอง ไม่ใช่ข้อมูลจริง)")


if __name__ == "__main__":
    main()
