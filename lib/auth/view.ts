import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_VIEW, VIEWS, VIEW_COOKIE, type ViewMode } from "@/lib/config/site";

export function parseView(value: string | undefined): ViewMode {
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as ViewMode) : DEFAULT_VIEW;
}

export async function getView(): Promise<ViewMode> {
  const store = await cookies();
  return parseView(store.get(VIEW_COOKIE)?.value);
}

export async function setView(view: ViewMode): Promise<void> {
  const store = await cookies();
  store.set(VIEW_COOKIE, view, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}
