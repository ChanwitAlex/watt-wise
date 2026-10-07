import { DISCLAIMER_REAL, DISCLAIMER_SYNTHETIC } from "@/lib/config/site";
import { loadModelParams } from "@/lib/data/model-params";

/** ข้อความเตือนบนสุด เลือกตามชนิดข้อมูลที่ใช้เทรนจริง (ธง synthetic ใน model_params.json) */
export async function DisclaimerBar() {
  const { synthetic } = await loadModelParams();
  return (
    <div className="disclaimer" role="note">
      {synthetic ? DISCLAIMER_SYNTHETIC : DISCLAIMER_REAL}
    </div>
  );
}
