export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f9fafb', color: '#000' }}>
        {children}
      </body>
    </html>
  );
}
