export default function EmptyState({
  title = 'No results',
  blurb = 'Try adjusting your filters or clearing them.',
}: { title?: string; blurb?: string }) {
  return (
    <div style={{
      border: '1px dashed rgba(0,0,0,.15)',
      borderRadius: 12,
      padding: 24,
      textAlign: 'center',
      color: '#475569'
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div>{blurb}</div>
    </div>
  );
}
