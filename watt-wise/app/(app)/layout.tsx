import { AppNav } from "@/components/layout/AppNav";
import { LocationBar } from "@/components/layout/LocationBar";
import { getSession } from "@/lib/auth/session";
import { getView } from "@/lib/auth/view";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, view] = await Promise.all([getSession(), getView()]);
  return (
    <>
      <AppNav name={session?.name ?? ""} view={view} />
      <main className="main">
        <LocationBar />
        {children}
      </main>
    </>
  );
}
