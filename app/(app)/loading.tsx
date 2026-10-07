import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div aria-busy="true">
      <Skeleton height={32} width="40%" />
      <div style={{ height: 16 }} />
      <Skeleton height={220} />
    </div>
  );
}
