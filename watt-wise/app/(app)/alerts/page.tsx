import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertsContent } from "@/components/forecast/AlertsContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLocation } from "@/lib/location/current";

export const metadata: Metadata = { title: "แจ้งเตือน" };

export default async function AlertsPage() {
  const loc = await getLocation();
  return (
    <>
      <PageHeader title="แจ้งเตือนและข้อความแนะนำ" description={`ชั่วโมงที่ควรระวังของพื้นที่: ${loc.label}`} />
      <Suspense key={`${loc.latitude}-${loc.longitude}`} fallback={<Skeleton height={240} />}>
        <AlertsContent latitude={loc.latitude} longitude={loc.longitude} />
      </Suspense>
    </>
  );
}
