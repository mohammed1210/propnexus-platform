"use client";
import Image, { ImageProps } from "next/image";
import { useState } from "react";

export default function ImageWithFallback(props: ImageProps) {
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <div
        className="w-full h-full grid place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs rounded-lg"
        aria-label="No image available"
      >
        No image
      </div>
    );
  }

  return <Image {...props} onError={() => setErr(true)} />;
}
