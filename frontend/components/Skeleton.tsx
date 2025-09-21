export function Skeleton({ h = 18, w = '100%', r = 8 }: {h?: number; w?: number | string; r?: number}) {
  return (
    <div
      style={{
        height: h,
        width: typeof w === 'number' ? `${w}px` : w,
        borderRadius: r,
        background:
          'linear-gradient(90deg, rgba(0,0,0,.06), rgba(0,0,0,.08), rgba(0,0,0,.06))',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.2s infinite',
      }}
    />
  );
}
