"""Watt Wise: สคริปต์เทรนแบบออฟไลน์ (รันซ้ำได้ random_state คงที่)

อ่าน  data/raw/*.csv
เขียน data/model_results.json, data/outage_scored.csv, data/usage_scored.csv
เว็บ Next.js อ่านไฟล์ที่เขียนออกมาเท่านั้น ไม่ต้องรัน Python บน Vercel

โปรโตคอล: แบ่งตามเวลา 70/30 (ไม่สุ่ม) เลือกพารามิเตอร์ด้วย TimeSeriesSplit บนชุดฝึกเท่านั้น
เกณฑ์เตือนไฟดับ 0.35 ตรงกับ lib/config/risk.ts ไม่ได้ปรับจากชุดทดสอบ
"""
import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (f1_score, mean_absolute_error, mean_squared_error,
                             precision_score, r2_score, recall_score,
                             roc_auc_score, silhouette_score)
from sklearn.model_selection import KFold, LeaveOneOut, TimeSeriesSplit
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")

SEED = 42
TRAIN_FRACTION = 0.7
WARNING_THRESHOLD = 0.35          # ต้องตรงกับ RISK_THRESHOLDS.warning ในเว็บ
HIGH_USAGE_QUANTILE = 0.8         # top 20% ของชุดฝึก
TREE_DEPTHS = [2, 3]
MLP_CANDIDATES = [(8,), (16,), (32,), (16, 8)]

MODELS = {}   # โมเดลที่เทรนแล้ว บันทึกเป็น data/model.pkl ตอนท้าย

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
OUTAGE_FILE = "outage_prediction_training_data.csv"
USAGE_FILE = "watt_wise_training_data.csv"
OUTAGE_BASE_FEATURES = ["hour", "is_weekend", "wind_speed_kmh", "rainfall_mm"]
OPTIONAL_OUTAGE_FEATURES = ["wind_gust_kmh", "is_holiday"]   # ใช้เมื่อมีในข้อมูลจริงและค่าไม่คงที่


def read_csv(path) -> pd.DataFrame:
    path = Path(path)
    if not path.is_absolute() and not path.exists():
        path = RAW / path
    return pd.read_csv(path, encoding="utf-8-sig")   # utf-8-sig ตัด BOM


def export_tree(tree: DecisionTreeClassifier, names):
    """ส่งออกต้นไม้เป็น JSON ให้เว็บคำนวณกับพยากรณ์อากาศได้โดยไม่ต้องรัน Python"""
    t = tree.tree_
    nodes = []
    for i in range(t.node_count):
        leaf = t.children_left[i] == -1
        counts = t.value[i][0]
        total = float(counts.sum())
        nodes.append({"leaf": bool(leaf),
                      "feature": None if leaf else names[t.feature[i]],
                      "threshold": None if leaf else float(t.threshold[i]),
                      "left": None if leaf else int(t.children_left[i]),
                      "right": None if leaf else int(t.children_right[i]),
                      "prob": r(float(counts[1] / total) if total else 0.0, 4)})
    return {"features": list(names), "nodes": nodes}


def usable_features(df, optional):
    return [c for c in optional if c in df.columns and df[c].nunique() > 1]


def r(x, nd=3):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), nd)


def safe_auc(y, score):
    return roc_auc_score(y, score) if len(set(y)) == 2 else float("nan")


def cls_metrics(y, pred, score):
    return {
        "precision": r(precision_score(y, pred, zero_division=0)),
        "recall": r(recall_score(y, pred, zero_division=0)),
        "f1": r(f1_score(y, pred, zero_division=0)),
        "auc": r(safe_auc(y, score)),
        "n_test": int(len(y)),
        "positives_test": int(np.sum(y)),
    }


def reg_metrics(y, pred):
    return {
        "mae": r(mean_absolute_error(y, pred)),
        "rmse": r(np.sqrt(mean_squared_error(y, pred))),
        "r2": r(r2_score(y, pred)),
        "n_test": int(len(y)),
    }


def tree_rules(tree: DecisionTreeClassifier, names, describe):
    """แปลงต้นไม้เป็นกฎอ่านง่าย: คืนรายการใบ (เงื่อนไข, ผลทำนาย, จำนวนตัวอย่าง)"""
    t = tree.tree_
    leaves = []

    def walk(node, conds):
        if t.children_left[node] == -1:
            counts = t.value[node][0]
            total = float(counts.sum())
            share = float(counts[1] / total) if total else 0.0
            leaves.append({
                "conditions": conds or ["ทุกกรณี"],
                "predicted": "high" if share >= 0.5 else "normal",
                "samples": int(t.n_node_samples[node]),
                "high_share": r(share),
            })
            return
        name, thr = names[t.feature[node]], float(t.threshold[node])
        walk(t.children_left[node], conds + [describe(name, thr, True)])
        walk(t.children_right[node], conds + [describe(name, thr, False)])

    walk(0, [])
    return leaves


# ---------------------------------------------------------------- โมดูล A
def run_outage(o: pd.DataFrame):
    o = o.copy()
    o["is_weekend"] = (o["day_type"] == "Weekend").astype(int)
    extra = usable_features(o, OPTIONAL_OUTAGE_FEATURES)
    n = len(o)
    n_train = int(n * TRAIN_FRACTION)
    tr, te = o.iloc[:n_train], o.iloc[n_train:]
    feats = OUTAGE_BASE_FEATURES + extra   # ไม่ใช้ grid_load / equipment_age / severity
    ytr, yte = tr["outage_occurred"].values, te["outage_occurred"].values

    # เลือกความลึกต้นไม้ด้วย TimeSeriesSplit บนชุดฝึกเท่านั้น
    tss = TimeSeriesSplit(n_splits=5)

    def make_tree(depth):
        return DecisionTreeClassifier(max_depth=depth, min_samples_leaf=10, random_state=SEED)

    def fold_aucs(depth):
        out = []
        for a, b in tss.split(tr):
            m = make_tree(depth).fit(tr.iloc[a][feats], ytr[a])
            out.append(safe_auc(ytr[b], m.predict_proba(tr.iloc[b][feats])[:, 1]))
        return out

    cv = {d: fold_aucs(d) for d in TREE_DEPTHS}
    cv_mean = {d: float(np.nanmean(v)) for d, v in cv.items()}
    depth = max(cv_mean, key=cv_mean.get)
    tree = make_tree(depth).fit(tr[feats], ytr)
    MODELS["outage_tree"] = {"model": tree, "features": feats, "warning_threshold": WARNING_THRESHOLD}
    p_test = tree.predict_proba(te[feats])[:, 1]

    rule_pred = (te["weather_severity"] >= WARNING_THRESHOLD).astype(int)
    rows = [
        {"id": "no_warning", "name": "ไม่เตือนเลย", "kind": "baseline",
         **cls_metrics(yte, np.zeros(len(yte), int), np.zeros(len(yte)))},
        {"id": "rule_based", "name": "กฎ: severity ≥ 0.35", "kind": "rule",
         **cls_metrics(yte, rule_pred, te["weather_severity"].values)},
        {"id": "decision_tree", "name": f"Decision Tree (ลึก {depth} ชั้น)", "kind": "trained",
         **cls_metrics(yte, (p_test >= WARNING_THRESHOLD).astype(int), p_test)},
    ]

    # ความเสี่ยงต่อชั่วโมงสำหรับแดชบอร์ด: ชุดฝึกใช้ค่า out-of-fold (ไม่ให้โมเดลเห็นแถวตัวเอง) ชุดทดสอบใช้โมเดลที่ฝึกกับชุดฝึก
    risk = np.zeros(n)
    for a, b in KFold(5, shuffle=False).split(tr):
        m = make_tree(depth).fit(tr.iloc[a][feats], ytr[a])
        risk[b] = m.predict_proba(tr.iloc[b][feats])[:, 1]
    risk[n_train:] = p_test

    # ระยะเวลาไฟดับ: Linear Regression บนเหตุการณ์ไฟดับทั้งหมด ประเมินด้วย leave-one-out
    ev = o[o["outage_occurred"] == 1]
    dfeats = ["hour", "wind_speed_kmh", "rainfall_mm"] + [c for c in extra if c != "is_holiday"]
    X, y = ev[dfeats].values, ev["outage_duration_min"].values
    loo_pred = np.zeros(len(ev)); loo_base = np.zeros(len(ev))
    for a, b in LeaveOneOut().split(X):
        loo_pred[b] = LinearRegression().fit(X[a], y[a]).predict(X[b])
        loo_base[b] = np.median(y[a])
    duration_model = LinearRegression().fit(X, y)
    MODELS["outage_duration"] = {"model": duration_model, "features": dfeats}
    pred_dur = np.clip(duration_model.predict(o[dfeats].values), 1, None)

    duration_rows = [
        {"id": "median", "name": "ค่ากลางของเหตุการณ์", "kind": "baseline",
         "mae": r(mean_absolute_error(y, loo_base)), "rmse": r(np.sqrt(mean_squared_error(y, loo_base))), "n_events": int(len(y))},
        {"id": "linear_regression", "name": "Linear Regression", "kind": "trained",
         "mae": r(mean_absolute_error(y, loo_pred)), "rmse": r(np.sqrt(mean_squared_error(y, loo_pred))), "n_events": int(len(y))},
    ]

    scored = o[["timestamp", "hour", "day_type", "wind_speed_kmh", "rainfall_mm", "weather_severity",
                "outage_occurred", "outage_duration_min"]].copy()
    scored["risk_prob"] = np.round(risk, 4)
    scored["pred_duration_min"] = np.round(pred_dur, 1)
    scored["split"] = ["train"] * n_train + ["test"] * (n - n_train)

    sev = LinearRegression().fit(o[["wind_speed_kmh", "rainfall_mm"]], o["weather_severity"])
    params = {
        "outage_tree": export_tree(tree, feats),
        "duration": {"features": dfeats, "coef": [float(c) for c in duration_model.coef_],
                     "intercept": float(duration_model.intercept_), "min_minutes": 1},
        "severity": {"wind_coef": float(sev.coef_[0]), "rain_coef": float(sev.coef_[1]),
                     "intercept": float(sev.intercept_),
                     "r2": r(sev.score(o[["wind_speed_kmh", "rainfall_mm"]], o["weather_severity"]), 6)},
    }
    result = {
        "classification": {
            "rows": rows, "tree_depth": int(depth),
            "cv_depth_auc": {str(d): r(v) for d, v in cv_mean.items()},
            "cv_fold_auc": [r(v) for v in cv[depth]],
            "features": feats,
        },
        "duration": {"rows": duration_rows, "features": dfeats, "protocol": f"leave-one-out บน {len(y)} เหตุการณ์"},
    }
    meta = {
        "rows": int(n), "train_rows": int(n_train), "test_rows": int(n - n_train),
        "outages_total": int(o["outage_occurred"].sum()),
        "outages_train": int(ytr.sum()), "outages_test": int(yte.sum()),
        "start": o["timestamp"].iloc[0], "end": o["timestamp"].iloc[-1],
    }
    return result, scored, meta, params


# ---------------------------------------------------------------- โมดูล B
def hour_feats(df):
    df["hr_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hr_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["is_weekend"] = (df["day_type"] == "Weekend").astype(int)


def describe_condition(name, thr, left):
    if name == "is_weekend":
        return "เป็นวันธรรมดา" if left else "เป็นวันหยุดสุดสัปดาห์"
    label = {"hour": "ชั่วโมง", "temperature_c": "อุณหภูมิ (°C)", "humidity_percent": "ความชื้น (%)"}.get(name, name)
    return f"{label} {'≤' if left else '>'} {thr:.1f}"


def fit_profile(df: pd.DataFrame):
    """ค่าเฉลี่ยตาม (วันหยุด?, ชั่วโมง) + ผลของอุณหภูมิที่เบี่ยงจากค่าปกติของชั่วโมงนั้น"""
    g = df.groupby(["is_weekend", "hour"])
    usage_tab = g["electricity_usage_kwh"].mean().unstack(fill_value=np.nan).reindex(index=[0, 1], columns=range(24))
    temp_tab = g["temperature_c"].mean().unstack(fill_value=np.nan).reindex(index=[0, 1], columns=range(24))
    usage_tab = usage_tab.fillna(usage_tab.mean())          # กันช่องว่างด้วยค่าเฉลี่ยของแถวอื่น
    temp_tab = temp_tab.fillna(temp_tab.mean())
    base = np.array([usage_tab.loc[w, h] for w, h in zip(df["is_weekend"], df["hour"])])
    dev = df["temperature_c"].values - np.array([temp_tab.loc[w, h] for w, h in zip(df["is_weekend"], df["hour"])])
    slope = float(LinearRegression(fit_intercept=False).fit(dev.reshape(-1, 1), df["electricity_usage_kwh"].values - base).coef_[0])
    return {"usage_mean": [[r(v, 4) for v in usage_tab.loc[i]] for i in (0, 1)],
            "temp_mean": [[r(v, 3) for v in temp_tab.loc[i]] for i in (0, 1)],
            "temp_slope_kwh_per_c": r(slope, 5)}


def predict_profile(df: pd.DataFrame, prof, use_temp: bool):
    um, tm, k = np.array(prof["usage_mean"]), np.array(prof["temp_mean"]), prof["temp_slope_kwh_per_c"]
    base = np.array([um[w, h] for w, h in zip(df["is_weekend"], df["hour"])])
    if not use_temp:
        return base
    return base + k * (df["temperature_c"].values - np.array([tm[w, h] for w, h in zip(df["is_weekend"], df["hour"])]))


def run_usage(u: pd.DataFrame, n_train: int):
    u = u.copy()
    if "is_holiday" in u.columns and u["is_holiday"].nunique() > 1:
        u["day_type"] = np.where((u["day_type"] == "Weekend") | (u["is_holiday"] == 1), "Weekend", "Weekday")  # วันหยุดนักขัตฤกษ์นับเป็นวันหยุด
    hour_feats(u)
    u["lag24"] = u["electricity_usage_kwh"].shift(24)     # ค่าชั่วโมงเดียวกันของเมื่อวาน
    y = u["electricity_usage_kwh"]
    base = ["hr_sin", "hr_cos", "is_weekend", "temperature_c", "humidity_percent"]
    lag = base + ["lag24"]
    tr_all, te = u.iloc[:n_train], u.iloc[n_train:]
    tr = tr_all.dropna(subset=["lag24"])                     # แถว 24 แถวแรกไม่มี lag
    ytr_all, yte = y.iloc[:n_train], y.iloc[n_train:]

    lr_base = LinearRegression().fit(tr_all[base], ytr_all)
    lr_lag = LinearRegression().fit(tr[lag], y.loc[tr.index])

    # MLP: เลือกขนาดชั้นซ่อนด้วย TimeSeriesSplit บนชุดฝึก
    def make_mlp(h):
        return make_pipeline(StandardScaler(), MLPRegressor(hidden_layer_sizes=h, max_iter=3000, random_state=SEED))

    tss = TimeSeriesSplit(n_splits=5)
    cv_mae = {}
    for h in MLP_CANDIDATES:
        errs = []
        for a, b in tss.split(tr):
            m = make_mlp(h).fit(tr.iloc[a][lag], y.loc[tr.index[a]])
            errs.append(mean_absolute_error(y.loc[tr.index[b]], m.predict(tr.iloc[b][lag])))
        cv_mae[h] = float(np.mean(errs))
    best_h = min(cv_mae, key=cv_mae.get)
    mlp = make_mlp(best_h).fit(tr[lag], y.loc[tr.index])
    MODELS["usage_mlp"] = {"model": mlp, "features": lag}

    profile = fit_profile(tr_all)
    rows = [
        {"id": "mean", "name": "ค่าเฉลี่ยชุดฝึก", "kind": "baseline", **reg_metrics(yte, np.full(len(yte), ytr_all.mean()))},
        {"id": "profile", "name": "ค่าเฉลี่ยตามชั่วโมง/ประเภทวัน", "kind": "trained", **reg_metrics(yte, predict_profile(te, profile, False))},
        {"id": "profile_temp", "name": "ค่าเฉลี่ยตามชั่วโมง + อุณหภูมิ (ใช้กับพยากรณ์อากาศ)", "kind": "trained", **reg_metrics(yte, predict_profile(te, profile, True))},
        {"id": "yesterday", "name": "ค่าชั่วโมงเดียวกันของเมื่อวาน", "kind": "baseline", **reg_metrics(yte, te["lag24"])},
        {"id": "linear_regression", "name": "Linear Regression (ไม่มี lag)", "kind": "trained", **reg_metrics(yte, lr_base.predict(te[base]))},
        {"id": "linear_regression_lag24", "name": "Linear Regression + lag 24 ชม.", "kind": "trained", **reg_metrics(yte, lr_lag.predict(te[lag]))},
        {"id": "mlp", "name": f"MLP ชั้นซ่อน {best_h} + lag 24 ชม.", "kind": "trained", **reg_metrics(yte, mlp.predict(te[lag]))},
    ]

    forecast = np.full(len(u), np.nan)
    ok = u["lag24"].notna()
    forecast[ok.values] = lr_lag.predict(u.loc[ok, lag])

    # Decision Tree: ชั่วโมงใช้ไฟสูง (top 20% ของชุดฝึก)
    thr = float(ytr_all.quantile(HIGH_USAGE_QUANTILE))
    high = (y >= thr).astype(int)
    tfeats = ["hour", "is_weekend", "temperature_c", "humidity_percent"]
    ytr_h, yte_h = high.iloc[:n_train].values, high.iloc[n_train:].values

    def cv_f1(depth):
        s = []
        for a, b in tss.split(tr_all):
            m = DecisionTreeClassifier(max_depth=depth, random_state=SEED).fit(tr_all.iloc[a][tfeats], ytr_h[a])
            s.append(f1_score(ytr_h[b], m.predict(tr_all.iloc[b][tfeats]), zero_division=0))
        return float(np.mean(s))

    cvs = {d: cv_f1(d) for d in TREE_DEPTHS}
    depth = max(cvs, key=cvs.get)
    tree = DecisionTreeClassifier(max_depth=depth, random_state=SEED).fit(tr_all[tfeats], ytr_h)
    MODELS["high_usage_tree"] = {"model": tree, "features": tfeats}
    p_te = tree.predict_proba(te[tfeats])[:, 1]
    yday = (te["lag24"] >= thr).astype(int)
    high_rows = [
        {"id": "no_warning", "name": "ไม่เตือนเลย", "kind": "baseline", **cls_metrics(yte_h, np.zeros(len(yte_h), int), np.zeros(len(yte_h)))},
        {"id": "yesterday", "name": "เมื่อวานชั่วโมงนี้สูง", "kind": "rule", **cls_metrics(yte_h, yday, te["lag24"].values)},
        {"id": "decision_tree", "name": f"Decision Tree (ลึก {depth} ชั้น)", "kind": "trained",
         **cls_metrics(yte_h, (p_te >= 0.5).astype(int), p_te)},
    ]

    # K-Means: โปรไฟล์ 24 ชม. ของแต่ละวัน
    u["date"] = u["timestamp"].str[:10]
    prof = u.pivot(index="date", columns="hour", values="electricity_usage_kwh")
    sil, fits = {}, {}
    for k in (2, 3):
        km = KMeans(k, n_init=10, random_state=SEED).fit(prof.values)
        sil[k], fits[k] = float(silhouette_score(prof.values, km.labels_)), km
    k = max(sil, key=sil.get)
    km = fits[k]
    order = np.argsort(km.cluster_centers_.mean(axis=1))          # กลุ่ม 0 = ใช้ไฟต่ำสุด
    remap = {int(old): new for new, old in enumerate(order)}
    labels = [remap[int(x)] for x in km.labels_]
    centers = [[r(v) for v in km.cluster_centers_[old]] for old in order]
    wk = u.groupby("date")["day_type"].first().reindex(prof.index)
    weekend = (wk == "Weekend").astype(int).values
    lab = np.array(labels)
    matched = int(max((lab == weekend).sum(), (lab != weekend).sum())) if k == 2 else None
    clusters = {
        "k": int(k), "silhouette": r(sil[k]), "silhouette_by_k": {str(a): r(b) for a, b in sil.items()},
        "profiles": centers, "sizes": [int(labels.count(i)) for i in range(k)],
        "days": [{"date": d, "cluster": c} for d, c in zip(prof.index, labels)],
        "weekday_match": {"matched": matched, "total": int(len(prof))} if matched is not None else None,
    }

    # ผลทำนายสำหรับหน้าเว็บ (tree บนทุกแถวเพื่อแสดงชั่วโมงสูง; ชุดทดสอบเป็นค่านอกตัวอย่าง)
    scored = u[["timestamp", "hour", "day_type", "temperature_c", "humidity_percent", "electricity_usage_kwh"]].copy()
    scored["forecast_kwh"] = np.round(forecast, 3)
    scored["high_actual"] = high.values
    scored["high_pred"] = (tree.predict_proba(u[tfeats])[:, 1] >= 0.5).astype(int)
    scored["split"] = ["train"] * n_train + ["test"] * (len(u) - n_train)

    result = {
        "forecast": {"rows": rows, "features": lag, "mlp_cv_mae": {str(h): r(v) for h, v in cv_mae.items()},
                     "train_rows_used": int(len(tr))},
        "high_usage": {"threshold_kwh": r(thr), "tree_depth": int(depth), "rows": high_rows,
                       "cv_depth_f1": {str(d): r(v) for d, v in cvs.items()},
                       "positive_share_test": r(yte_h.mean()),
                       "rules": tree_rules(tree, tfeats, describe_condition)},
        "clusters": clusters,
    }
    dropped = {"is_holiday": "เป็น 0 ทุกแถว"}
    return result, scored, dropped, {"usage_profile": profile}


def main():
    ap = argparse.ArgumentParser(description="เทรนโมเดล Watt Wise")
    ap.add_argument("--outage", default=OUTAGE_FILE, help="CSV ไฟดับรายชั่วโมง (ค่าเริ่มต้น: data/raw/...)")
    ap.add_argument("--usage", default=USAGE_FILE, help="CSV การใช้ไฟรายชั่วโมง")
    ap.add_argument("--synthetic", action="store_true", help="ระบุว่าข้อมูลที่ใช้เทรนเป็นข้อมูลสังเคราะห์ (หน้าเว็บจะแสดงป้ายเตือน)")
    args = ap.parse_args()
    outage_raw = read_csv(args.outage)
    usage_raw = read_csv(args.usage)
    outage, outage_scored, meta, outage_params = run_outage(outage_raw)
    usage, usage_scored, dropped, usage_params = run_usage(usage_raw, int(len(usage_raw) * TRAIN_FRACTION))

    results = {
        "seed": SEED,
        "split": {"rule": "แบ่งตามเวลา 70/30 ไม่สุ่ม", "train_rows": meta["train_rows"], "test_rows": meta["test_rows"]},
        "data": {
            "synthetic": bool(args.synthetic),
            "period": [meta["start"], meta["end"]], "rows": meta["rows"],
            "outages_total": meta["outages_total"], "outages_train": meta["outages_train"], "outages_test": meta["outages_test"],
            "outage_rate": r(meta["outages_total"] / meta["rows"]),
            "dropped_columns": {
                "equipment_age_years": "เป็น 4.7 ทุกแถว ใช้เป็นฟีเจอร์ไม่ได้",
                "grid_load_percent": "ไม่ใช้ในโมเดล (ตรงกับข้อเสนอ) และซ่อนจากตารางประวัติ",
                "is_holiday": dropped["is_holiday"],
            },
        },
        "outage": outage,
        "usage": usage,
        "limitations": [
            ("ข้อมูลที่ใช้เทรนเป็นข้อมูลจำลองที่สร้างด้วยสคริปต์ (ml/make_realistic_synthetic.py หรือ make_synthetic.py) ไม่ใช่สถิติไฟดับจริง ตัวเลขความแม่นวัดกับโลกที่ตัวสร้างตั้งขึ้น ไม่ได้บอกว่าจะแม่นกับไฟดับจริง"
             if args.synthetic else "ข้อมูลทั้งสองชุดเป็นข้อมูลตัวอย่าง/จำลอง ไม่ใช่การพยากรณ์ไฟดับจริงในประเทศไทย"),
            f"ไฟดับในชุดทดสอบมีเพียง {meta['outages_test']} ครั้ง ผลจึงยังไม่เสถียร",
            "weather_severity คำนวณจากลมและฝนโดยตรง (ประมาณ ลม ÷ 120 + ฝน ÷ 80) ไม่ใช่ข้อมูลอิสระ",
            "ค่ารายโซนในแผนที่ความร้อนเป็นการจำลอง ไม่ได้มาจากโมเดล",
            f"ข้อมูลการใช้ไฟมี {len(usage_raw) // 24} วัน ไม่มีฤดูกาลครบปี ผลต่างเล็ก ๆ ระหว่างโมเดลไม่ควรตีความว่าดีกว่าอย่างมีนัยสำคัญ",
        ],
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "model_results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    params = {**outage_params, **usage_params, "trained_on": {"outage": str(args.outage), "usage": str(args.usage)},
              "synthetic": bool(args.synthetic)}
    (OUT / "model_params.json").write_text(json.dumps(params, ensure_ascii=False) + "\n", encoding="utf-8")
    outage_scored.to_csv(OUT / "outage_scored.csv", index=False)
    usage_scored.to_csv(OUT / "usage_scored.csv", index=False)
    import joblib, sklearn
    joblib.dump({"models": MODELS, "synthetic": bool(args.synthetic), "seed": SEED, "sklearn_version": sklearn.__version__,
                 "trained_on": {"outage": str(args.outage), "usage": str(args.usage)}}, OUT / "model.pkl")
    print("เขียนผลลง data/ เรียบร้อย")


if __name__ == "__main__":
    main()
