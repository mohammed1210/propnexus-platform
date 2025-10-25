'use client';
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error(error);
  return (
    <html>
      <body>
        <main style={{ padding: 24 }}>
          <h1>Something went wrong</h1>
          <p>Please try again or refresh the page.</p>
        </main>
      </body>
    </html>
  );
}
