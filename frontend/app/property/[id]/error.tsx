'use client';

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Couldn’t load this property</h2>
      <p className="opacity-80 text-sm">{error.message}</p>
    </div>
  );
}
