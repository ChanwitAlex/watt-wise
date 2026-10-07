import { Skeleton } from "@/components/ui/Skeleton";

export function SummaryCardsSkeleton() {
  return (
    <div className="cards" aria-busy="true">
      <div className="card card--wide">
        <Skeleton height={14} width="50%" />
        <Skeleton height={44} width="30%" />
        <Skeleton height={18} />
      </div>
      {[0, 1, 2].map((i) => (
        <div className="card" key={i}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={32} width="50%" />
          <Skeleton height={12} />
        </div>
      ))}
    </div>
  );
}
