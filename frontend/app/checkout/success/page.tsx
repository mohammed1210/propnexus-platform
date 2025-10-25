export default function Success() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">You’re all set 🎉</h1>
      <p className="mt-4">We’ve emailed you a Magic Link. Open it on this device to jump straight in.</p>
      <a href="/auth/resend" className="inline-block mt-6 underline">Didn’t get it? Resend</a>
    </main>
  );
}
