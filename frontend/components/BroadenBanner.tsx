export const BroadenBanner = ({
  changes,
  onUndo,
}: {
  changes: Record<string, string>;
  onUndo: () => void;
}) => (
  <div className="bg-amber-50 border border-amber-300 p-3 mb-4 rounded">
    We broadened your search&nbsp;
    {Object.entries(changes).map(([k, v], i) => (
      <span key={k}>
        {i > 0 && ", "}
        <strong>{k}</strong> to <em>{v}</em>
      </span>
    ))}
    .&nbsp;
    <button onClick={onUndo} className="underline">
      Undo
    </button>
  </div>
);
