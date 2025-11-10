import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'UI Preview - PropNexus',
  description: 'Interactive design preview showcasing the new blue/teal brand palette',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
