import { useEffect } from 'react';

const SubscribePage = () => {
  const handleSubscribe = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/create-checkout-session`, {
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
