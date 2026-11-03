export const Spinner = ({ label = 'Loading' }) => <span className="spinner" role="status" aria-label={label} />;

export const Skeleton = ({ height = 16, width = '100%', radius = 8, style }) => (
  <span className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />
);

export function CardSkeleton({ height = 260 }) {
  return (
    <div className="card" aria-busy="true">
      <Skeleton height={18} width="40%" />
      <Skeleton height={height} style={{ marginTop: 16 }} radius={12} />
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="card summary-card" aria-busy="true">
      <Skeleton height={14} width="50%" />
      <Skeleton height={30} width="70%" style={{ marginTop: 14 }} />
    </div>
  );
}

export function RowsSkeleton({ rows = 5 }) {
  return (
    <div className="rows-skeleton" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={52} radius={10} />
      ))}
    </div>
  );
}

export default function LoadingState({ text = 'Loading…' }) {
  return (
    <div className="center-state">
      <Spinner />
      <p>{text}</p>
    </div>
  );
}
