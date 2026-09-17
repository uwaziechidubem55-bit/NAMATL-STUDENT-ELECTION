// Reusable loading skeletons — match NAMATL navy/gold theme
const shimmerKeyframes = `
@keyframes namatlShimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}`;

const shimmerStyle = {
  background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
  backgroundSize: '800px 100%',
  animation: 'namatlShimmer 1.4s infinite linear',
  borderRadius: '8px',
};

export function SkeletonBox({ style = {} }) {
  return <div style={{ ...shimmerStyle, ...style }} />;
}

// Student ballot skeleton — mimics candidate cards grouped by position
export function BallotSkeleton() {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      {[0, 1].map((group) => (
        <div key={group} style={{ marginTop: '28px' }}>
          <SkeletonBox style={{ height: '24px', width: '200px', marginBottom: '16px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                background: 'white', borderRadius: '16px', padding: '24px 18px',
                border: '1px solid #e8ecf0', textAlign: 'center', position: 'relative',
              }}>
                <SkeletonBox style={{ height: '96px', width: '96px', borderRadius: '50%', margin: '0 auto 14px' }} />
                <SkeletonBox style={{ height: '16px', width: '70%', margin: '0 auto 8px' }} />
                <SkeletonBox style={{ height: '12px', width: '45%', margin: '0 auto 14px' }} />
                <SkeletonBox style={{ height: '44px', width: '100%' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// Staff results table skeleton — mimics the monitoring tables
export function ResultsTableSkeleton() {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      {[0, 1, 2].map((pos) => (
        <div key={pos} style={{ marginBottom: '24px', border: '1px solid #e8ecf0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#f7fafc', display: 'flex', justifyContent: 'space-between' }}>
            <SkeletonBox style={{ height: '16px', width: '160px' }} />
            <SkeletonBox style={{ height: '16px', width: '80px' }} />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ padding: '12px 16px', display: 'flex', gap: '16px', borderBottom: '1px solid #f0f2f5' }}>
              <SkeletonBox style={{ height: '14px', width: '20px' }} />
              <SkeletonBox style={{ height: '14px', flex: 2 }} />
              <SkeletonBox style={{ height: '14px', width: '60px' }} />
              <SkeletonBox style={{ height: '14px', width: '50px' }} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Admin dashboard stat-cards skeleton
export function StatsGridSkeleton({ count = 4 }) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #e8ecf0', borderRadius: '12px', padding: '18px' }}>
            <SkeletonBox style={{ height: '12px', width: '50%', marginBottom: '10px' }} />
            <SkeletonBox style={{ height: '28px', width: '35%' }} />
          </div>
        ))}
      </div>
    </>
  );
}