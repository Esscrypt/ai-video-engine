import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { navigateToPath } from "@/lib/router";
import { useState } from "react";

const plans = [
  {
    name: "Basic",
    credits: "1,990 credits / month",
    creditsToBuy: 1990,
    price: "$19.90 / month",
    features: ["~11 HD generations", "Standard queue", "Email support"],
  },
  {
    name: "Pro",
    credits: "3,990 credits / month",
    creditsToBuy: 3990,
    price: "$31.92 / month",
    features: ["~22 HD generations", "Priority queue", "Early model access"],
  },
  {
    name: "Max",
    credits: "5,990 credits / month",
    creditsToBuy: 5990,
    price: "$47.92 / month",
    features: ["~33 HD generations", "Highest priority", "Dedicated support"],
  },
];

export default function PricingPage() {
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [isCreatingApplePayIntent, setIsCreatingApplePayIntent] = useState(false);

  const onApplePayIntent = async (creditsToBuy: number) => {
    setPaymentMessage(null);
    setPaymentErrorMessage(null);
    setIsCreatingApplePayIntent(true);

    try {
      const response = await apiRequest<{ clientSecret: string; paymentIntentId: string }>(
        "/api/payments/stripe/apple-pay-intent",
        {
          method: "POST",
          body: JSON.stringify({
            creditsToBuy,
          }),
        },
      );
      setPaymentMessage(`Apple Pay intent created: ${response.paymentIntentId}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setPaymentErrorMessage("Sign in is required before creating an Apple Pay payment.");
        navigateToPath("/login?next=/pricing");
        return;
      }

      if (error instanceof ApiClientError) {
        setPaymentErrorMessage(error.message);
      } else {
        setPaymentErrorMessage("Could not create Apple Pay payment intent.");
      }
    } finally {
      setIsCreatingApplePayIntent(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
        <p className="mt-2 text-muted-foreground">Start with free usage and upgrade when you need higher throughput.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map(plan => (
          <Card key={plan.name} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.credits}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold">{plan.price}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map(feature => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <NavLink href="/login">Choose Plan</NavLink>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onApplePayIntent(plan.creditsToBuy)}
                disabled={isCreatingApplePayIntent}
              >
                {isCreatingApplePayIntent ? "Preparing Apple Pay..." : "Pay with Apple Pay"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
      {paymentMessage ? <p className="text-sm text-muted-foreground">{paymentMessage}</p> : null}
      {paymentErrorMessage ? <p className="text-sm text-destructive">{paymentErrorMessage}</p> : null}
    </div>
  );
}
