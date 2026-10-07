"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDeviceLocationAction } from "@/lib/location/actions";

export function LocateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง เลือกจังหวัดจากรายการแทน");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await setDeviceLocationAction(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
        if (result.error) setError(result.error);
        else router.refresh();
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เลือกจังหวัดจากรายการแทนได้" : "หาตำแหน่งไม่สำเร็จ ลองใหม่หรือเลือกจังหวัดแทน");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <span className="locate">
      <button type="button" className="btn btn--primary" onClick={locate} disabled={busy}>
        {busy ? "กำลังหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
      </button>
      {error ? (
        <span role="alert" className="form__error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
