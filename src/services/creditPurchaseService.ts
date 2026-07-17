import { apiRequest } from "../lib/api";

export type CreditPackageId = "credits_50" | "credits_100" | "credits_200";

export type CreditPackage = {
  id: CreditPackageId;
  credits: number;
  amountRupees: number;
  amountPaise: number;
  label: string;
};

type CreateOrderResponse = {
  ok: true;
  keyId: string;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  package: CreditPackage;
};

type VerifyPaymentResponse = {
  ok: true;
  alreadyProcessed: boolean;
  creditsAdded: number;
  creditsRemaining: number;
};

export const creditPurchaseService = {
  createOrder(packageId: CreditPackageId) {
    return apiRequest<CreateOrderResponse>("/api/credits/orders", {
      method: "POST",
      body: { packageId },
    });
  },

  verifyPayment(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    return apiRequest<VerifyPaymentResponse>("/api/credits/verify", {
      method: "POST",
      body: input,
    });
  },
};
