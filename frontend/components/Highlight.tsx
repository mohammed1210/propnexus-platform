import React from "react";

export const Highlight = ({
  text,
  tokens,
}: {
  text: string;
  tokens: string[];
}) => {
  if (tokens.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${tokens.join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-300 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};
