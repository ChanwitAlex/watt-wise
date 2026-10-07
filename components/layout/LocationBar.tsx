import { PROVINCES } from "@/lib/config/provinces";
import { selectProvinceAction } from "@/lib/location/actions";
import { getLocation } from "@/lib/location/current";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { LocateButton } from "./LocateButton";

/** แถบแสดงพื้นที่ที่กำลังดู + ปุ่มใช้ตำแหน่งปัจจุบัน + เลือกจังหวัด */
export async function LocationBar() {
  const loc = await getLocation();
  return (
    <section className="locbar" aria-label="พื้นที่ที่แสดง">
      <p className="locbar__label">
        พื้นที่: <strong>{loc.label}</strong>{" "}
        <span className="muted">
          ({loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)})
        </span>
      </p>
      <div className="locbar__controls">
        <LocateButton />
        <form action={selectProvinceAction} className="locbar__form">
          <label htmlFor="province" className="muted">
            หรือเลือกจังหวัด
          </label>
          <select id="province" name="province" defaultValue={loc.province}>
            {PROVINCES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <SubmitButton variant="ghost" pendingText="กำลังเปลี่ยน...">
            ไป
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
