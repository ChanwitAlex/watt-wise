import type { Metadata } from "next";
import { Suspense } from "react";
import { ForecastContent } from "@/components/forecast/ForecastContent";
import { ClimatologyContent } from "@/components/predict/ClimatologyContent";
import { PredictControls } from "@/components/predict/PredictControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { clampTarget, predictionMode, todayBangkok } from "@/lib/analytics/dates";
import { getView } from "@/lib/auth/view";
import { FORECAST_DAYS, MAX_AHEAD_YEARS } from "@/lib/config/weather";
import { formatThaiDate } from "@/lib/format";
import { getLocation } from "@/lib/location/current";

export const metadata: Metadata = { title: "แดชบอร์ด" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const [loc, viewMode] = await Promise.all([getLocation(), getView()]);
  const today = todayBangkok();
  const { date, adjusted } = clampTarget(requested, today, MAX_AHEAD_YEARS);
  const mode = predictionMode(date, today, FORECAST_DAYS);
  return (
    <>
      <PageHeader title="แดชบอร์ด: ทำนายว่าไฟจะดับไหม" />
      <PredictControls date={date} today={today} />
      {adjusted ? (
        <p className="callout">
          วันที่ที่ระบุอยู่นอกช่วงที่ทำนายได้ (ตั้งแต่วันนี้ถึง {MAX_AHEAD_YEARS} ปีข้างหน้า) จึงปรับเป็น {formatThaiDate(date)}
        </p>
      ) : null}
      <Suspense key={`${mode}-${date}-${loc.latitude}-${loc.longitude}-${viewMode}`} fallback={<Skeleton height={360} />}>
        {mode === "forecast" ? (
          <ForecastContent date={date} latitude={loc.latitude} longitude={loc.longitude} viewMode={viewMode} />
        ) : (
          <ClimatologyContent date={date} latitude={loc.latitude} longitude={loc.longitude} />
        )}
      </Suspense>
    </>
  );
}
