"""สร้างข้อมูล "สังเคราะห์" ขนาดใหญ่ ที่มีสถิติใกล้เคียงข้อมูลตัวอย่าง 720 แถว

!! นี่ไม่ใช่ข้อมูลจริง !!  ตัวสร้างเรียนรู้รูปแบบจากตัวอย่าง 720 แถว (30 วัน) แล้วสุ่มต่อเป็นจำนวนวันที่ต้องการ
- อากาศ: วัฏจักรรายวัน + ความต่างระหว่างวัน + ฝนเป็นช่วง ๆ (Markov) ตามที่วัดได้จากตัวอย่าง
- ไฟดับ: ความน่าจะเป็นเป็นฟังก์ชัน logistic ของ weather_severity ที่ฟิตจากตัวอย่าง (ตัวอย่างมีเหตุการณ์เพียง 34 ครั้ง)
- การใช้ไฟ: ค่าเฉลี่ยตามชั่วโมง/ประเภทวัน + ผลของอุณหภูมิ + สัญญาณรบกวน ตามที่ฟิตจากตัวอย่าง
- ไม่มีฤดูกาล (ทุกวันเหมือนเดือนสิงหาคม) ไม่มีผลของอุปกรณ์ ไม่มีโหลดกริดที่ส่งผลต่อไฟดับ

ผลที่ตามมา: โมเดลที่เทรนด้วยข้อมูลนี้ถูกวัดกับ "โลกที่สคริปต์นี้ตั้งขึ้น" ตัวเลขความแม่นไม่บอกว่าจะแม่นกับไฟดับจริง
ข้อดีที่เป็นจริง: ทดสอบระบบกับข้อมูลขนาดหมื่นแถว และทำให้ผลประเมินเสถียรขึ้น (เหตุการณ์ในชุดทดสอบมากขึ้น)

  python ml/make_synthetic.py                       # 420 วัน = 10,080 แถว
  python ml/make_synthetic.py --days 600 --seed 7
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def fit_generator(o: pd.DataFrame, u: pd.DataFrame) -> dict:
    p = {}
    # --- อุณหภูมิ/ความชื้น
    p["temp_by_hour"] = u.groupby("hour")["temperature_c"].mean().reindex(range(24)).values
    daily = u.assign(date=u["timestamp"].str[:10]).groupby("date")["temperature_c"].mean()
    offsets = (daily - daily.mean()).values
    p["temp_day_std"] = float(offsets.std(ddof=1))
    p["temp_day_phi"] = float(np.clip(np.corrcoef(offsets[:-1], offsets[1:])[0, 1], 0.0, 0.8))
    resid = u["temperature_c"] - p["temp_by_hour"][u["hour"].values] - np.repeat(offsets, 24)[: len(u)]
    p["temp_noise_std"] = float(resid.std(ddof=1))
    hum = LinearRegression().fit(u[["temperature_c"]], u["humidity_percent"])
    p["hum_coef"], p["hum_intercept"] = float(hum.coef_[0]), float(hum.intercept_)
    p["hum_noise_std"] = float((u["humidity_percent"] - hum.predict(u[["temperature_c"]])).std(ddof=1))
    # --- ฝน: Markov รายชั่วโมง + ปริมาณแบบ gamma
    wet = (o["rainfall_mm"].values > 0).astype(int)
    p["p_wet_after_wet"] = float(wet[1:][wet[:-1] == 1].mean())
    p["p_wet_after_dry"] = float(wet[1:][wet[:-1] == 0].mean())
    pos = o.loc[o["rainfall_mm"] > 0, "rainfall_mm"]
    p["rain_shape"] = float(pos.mean() ** 2 / pos.var(ddof=1))
    p["rain_scale"] = float(pos.var(ddof=1) / pos.mean())
    # --- ลม: log-linear ตามว่าฝนตกหรือไม่
    lw = np.log(o["wind_speed_kmh"].clip(lower=0.5))
    wind = LinearRegression().fit(wet.reshape(-1, 1), lw)
    p["wind_dry"], p["wind_wet_extra"] = float(wind.intercept_), float(wind.coef_[0])
    p["wind_noise_std"] = float((lw - wind.predict(wet.reshape(-1, 1))).std(ddof=1))
    # --- โหลดกริด (ไม่ใช้ในโมเดล แต่คงคอลัมน์ไว้ให้รูปแบบเหมือนตัวอย่าง)
    p["grid_by_hour"] = o.groupby("hour")["grid_load_percent"].mean().reindex(range(24)).values
    p["grid_noise_std"] = float((o["grid_load_percent"] - p["grid_by_hour"][o["hour"].values]).std(ddof=1))
    # --- ไฟดับ
    logit = LogisticRegression(C=100, max_iter=1000).fit(o[["weather_severity"]], o["outage_occurred"])
    p["outage_b0"], p["outage_b1"] = float(logit.intercept_[0]), float(logit.coef_[0][0])
    ev = o[o["outage_occurred"] == 1]
    dur = LinearRegression().fit(ev[["weather_severity"]], ev["outage_duration_min"])
    p["dur_a"], p["dur_b"] = float(dur.intercept_), float(dur.coef_[0])
    p["dur_noise_std"] = float((ev["outage_duration_min"] - dur.predict(ev[["weather_severity"]])).std(ddof=1))
    p["dur_min"] = float(ev["outage_duration_min"].min())
    # --- การใช้ไฟ: ค่าเฉลี่ยตาม (วันหยุด?, ชั่วโมง) + ผลอุณหภูมิ
    u = u.assign(off=(u["day_type"] == "Weekend").astype(int))
    tab = u.groupby(["off", "hour"])["electricity_usage_kwh"].mean().unstack().reindex(index=[0, 1], columns=range(24))
    ttab = u.groupby(["off", "hour"])["temperature_c"].mean().unstack().reindex(index=[0, 1], columns=range(24))
    p["usage_tab"], p["usage_temp_tab"] = tab.fillna(tab.loc[0]).values, ttab.fillna(ttab.loc[0]).values
    base = p["usage_tab"][u["off"].values, u["hour"].values]
    dev = u["temperature_c"].values - p["usage_temp_tab"][u["off"].values, u["hour"].values]
    slope = LinearRegression(fit_intercept=False).fit(dev.reshape(-1, 1), u["electricity_usage_kwh"].values - base)
    p["usage_slope"] = float(slope.coef_[0])
    p["usage_noise_std"] = float((u["electricity_usage_kwh"].values - base - p["usage_slope"] * dev).std(ddof=1))
    return p


def simulate(p: dict, days: int, start: str, seed: int):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, periods=days * 24, freq="h")
    n = len(idx)
    hour = idx.hour.values
    weekend = (idx.dayofweek >= 5).astype(int)

    off = np.zeros(days)
    for d in range(1, days):
        off[d] = p["temp_day_phi"] * off[d - 1] + rng.normal(0, p["temp_day_std"] * np.sqrt(1 - p["temp_day_phi"] ** 2))
    temp = p["temp_by_hour"][hour] + np.repeat(off, 24) + rng.normal(0, p["temp_noise_std"], n)
    hum = np.clip(p["hum_intercept"] + p["hum_coef"] * temp + rng.normal(0, p["hum_noise_std"], n), 30, 100)

    wet = np.zeros(n, dtype=int)
    for i in range(1, n):
        wet[i] = rng.random() < (p["p_wet_after_wet"] if wet[i - 1] else p["p_wet_after_dry"])
    rain = np.where(wet == 1, rng.gamma(p["rain_shape"], p["rain_scale"], n), 0.0)
    wind = np.clip(np.exp(p["wind_dry"] + p["wind_wet_extra"] * wet + rng.normal(0, p["wind_noise_std"], n)), 0.5, 65)
    sev = wind / 120 + rain / 80                     # สูตรเดียวกับข้อมูลตัวอย่าง (ยืนยัน R²≈1)
    grid = np.clip(p["grid_by_hour"][hour] + rng.normal(0, p["grid_noise_std"], n), 15, 95)

    occurred = (rng.random(n) < sigmoid(p["outage_b0"] + p["outage_b1"] * sev)).astype(int)
    duration = np.where(occurred == 1, np.maximum(p["dur_min"], p["dur_a"] + p["dur_b"] * sev + rng.normal(0, p["dur_noise_std"], n)), 0)

    base = p["usage_tab"][weekend, hour]
    dev = temp - p["usage_temp_tab"][weekend, hour]
    usage = np.clip(base + p["usage_slope"] * dev + rng.normal(0, p["usage_noise_std"], n), 0.3, None)

    stamp = idx.strftime("%Y-%m-%d %H:%M")
    day_type = np.where(weekend == 1, "Weekend", "Weekday")
    outage = pd.DataFrame({
        "timestamp": stamp, "hour": hour, "day_type": day_type, "wind_speed_kmh": wind.round(1), "rainfall_mm": rain.round(1),
        "weather_severity": sev.round(3), "equipment_age_years": 4.7, "grid_load_percent": grid.round(1),
        "outage_occurred": occurred, "outage_duration_min": duration.round().astype(int),
    })
    usage_df = pd.DataFrame({
        "timestamp": stamp, "hour": hour, "day_type": day_type, "is_holiday": 0, "temperature_c": temp.round(1),
        "humidity_percent": hum.round(1), "electricity_usage_kwh": usage.round(3),
    })
    return outage, usage_df


def report(name, real, fake, cols):
    print(f"\n{name}: ตัวอย่างจริง {len(real):,} แถว  ->  สังเคราะห์ {len(fake):,} แถว")
    for c in cols:
        print(f"  {c:24s} mean {real[c].mean():8.3f} -> {fake[c].mean():8.3f}   std {real[c].std():7.3f} -> {fake[c].std():7.3f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=420, help="จำนวนวัน (420 วัน = 10,080 แถว)")
    ap.add_argument("--start", default="2025-08-01")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--outage-in", default=str(RAW / "outage_prediction_training_data.csv"))
    ap.add_argument("--usage-in", default=str(RAW / "watt_wise_training_data.csv"))
    args = ap.parse_args()
    o = pd.read_csv(args.outage_in, encoding="utf-8-sig")
    u = pd.read_csv(args.usage_in, encoding="utf-8-sig")
    fake_o, fake_u = simulate(fit_generator(o, u), args.days, args.start, args.seed)
    fake_o.to_csv(RAW / "outage_synthetic.csv", index=False)
    fake_u.to_csv(RAW / "usage_synthetic.csv", index=False)
    report("ไฟดับ", o, fake_o, ["wind_speed_kmh", "rainfall_mm", "weather_severity", "outage_occurred", "outage_duration_min"])
    report("การใช้ไฟ", u, fake_u, ["temperature_c", "humidity_percent", "electricity_usage_kwh"])
    ev = int(fake_o["outage_occurred"].sum())
    print(f"\nเหตุการณ์ไฟดับสังเคราะห์ {ev} ครั้ง ({ev / len(fake_o):.1%}) เทียบตัวอย่าง {int(o['outage_occurred'].sum())} ครั้ง ({o['outage_occurred'].mean():.1%})")
    print("เขียน data/raw/outage_synthetic.csv และ data/raw/usage_synthetic.csv (ข้อมูลสังเคราะห์ ไม่ใช่ข้อมูลจริง)")


if __name__ == "__main__":
    main()
