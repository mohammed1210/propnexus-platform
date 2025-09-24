import { useState } from "react";
import { StrategiesRequest, Strategy } from "../../types/ai";
import { postAiStrategies } from "../../lib/api";
import Toast from "../ui/Toast";

interface Props {
  property: Record<string, any>;
  constraints?: Record<string, any>;
}

export default function ExitStrategyGenerator({ property, constraints }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateStrategies = async () => {
    setLoading(true);
    setError("");
    try {
      const req: StrategiesRequest = { property, constraints };
      const res = await postAiStrategies(req);
      setStrategies(res.strategies);
    } catch (e: any) {
      setError(e.message || "Failed to generate strategies");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={generateStrategies}>Generate exit strategies</button>
      {loading && <p>Generating...</p>}
      {strategies.map((s, idx) => (
        <div key={idx} className="strategy-card">
          <h3>{s.title}</h3>
          <p>{s.rationale}</p>
          {s.steps?.length > 0 && (
            <ol>
              {s.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {s.risk && (
            <p>
              <strong>Risk:</strong> {s.risk}
            </p>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${s.title}\n${s.rationale}\n${s.steps.join("\n")}`,
              );
            }}
          >
            Copy to clipboard
          </button>
        </div>
      ))}
      {error && <Toast message={error} onClose={() => setError("")} />}
    </div>
  );
}
