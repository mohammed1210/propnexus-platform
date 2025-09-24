import { useEffect, useState } from "react";
import { SummaryResponse, SummaryRequest } from "../../types/ai";
import { postAiSummary } from "../../lib/api";
import Toast from "../ui/Toast";

interface Props {
  title: string;
  price?: number;
  location: string;
  yield?: number;
  roi?: number;
  description?: string;
}

export default function InvestmentSummary(props: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError("");
      try {
        const req: SummaryRequest = {
          title: props.title,
          price: props.price,
          location: props.location,
          yield: props.yield,
          roi: props.roi,
          description: props.description,
        };
        const res = await postAiSummary(req);
        setSummary(res);
      } catch (e: any) {
        setError(e.message || "Failed to load summary");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [props.title, props.price, props.location, props.yield, props.roi, props.description]);

  return (
    <div>
      <h2>Investment Summary</h2>
      {loading && <p>Loading...</p>}
      {!loading && summary && (
        <>
          <p data-testid="investment-summary-text">{summary.summary}</p>
          {summary.bullets && summary.bullets.length > 0 && (
            <ul>
              {summary.bullets.slice(0, 5).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {!loading && !summary && !error && <p>No summary available.</p>}
      {error && <Toast message={error} onClose={() => setError("")} />}
    </div>
  );
}
