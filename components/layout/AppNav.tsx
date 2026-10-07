import Link from "next/link";
import { logoutAction, switchViewAction } from "@/lib/auth/actions";
import { SITE_NAME, type ViewMode } from "@/lib/config/site";
import { Bolt } from "@/components/ui/Bolt";

const LINKS = [
  { href: "/dashboard", label: "แดชบอร์ด" },
];

export function AppNav({ name, view }: { name: string; view: ViewMode }) {
  const next: ViewMode = view === "manager" ? "general" : "manager";
  return (
    <nav className="nav" aria-label="เมนูหลัก">
      <Link href="/dashboard" className="nav__brand">
        <Bolt />
        {SITE_NAME}
      </Link>
      <ul className="nav__links">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
      <div className="nav__user">
        <form action={switchViewAction}>
          <input type="hidden" name="view" value={next} />
          <button type="submit" className="btn btn--ghost" title="สลับมุมมอง">
            มุมมอง: {view === "manager" ? "ผู้ดูแลอาคาร" : "ผู้ใช้ทั่วไป"} (สลับ)
          </button>
        </form>
        <span className="muted nav__name">{name}</span>
        <form action={logoutAction}>
          <button type="submit" className="btn btn--ghost">
            ออกจากระบบ
          </button>
        </form>
      </div>
    </nav>
  );
}
