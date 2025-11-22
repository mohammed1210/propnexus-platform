import { useEffect } from 'react';

const SubscribePage = () => {
  const handleSubscribe = async () => {
    try {
      // Resolve backend URL using standard env var priority (consistent with lib/api.ts)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data && data.sessionId) {
        // Redirect to Stripe Checkout
        window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`;
      }
    } catch (error) {
      console.error('Error creating checkout session', error);
    }
  };

  useEffect(() => {
    handleSubscribe();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Redirecting to payment...</p>
    </div>
  );
};

export default SubscribePage;
