import { useState } from "react";
import {
  creditPurchaseService,
  type CreditPackageId,
} from "../services/creditPurchaseService";

const PACKAGES = [
  {
    id: "credits_50" as const,
    credits: 50,
    amount: 7000,
    eyebrow: "Starter",
    description: "A practical top-up for focused case research and drafting work.",
  },
  {
    id: "credits_100" as const,
    credits: 100,
    amount: 10000,
    eyebrow: "Most Popular",
    description: "Better value for regular legal research, judgments, and drafting.",
    featured: true,
  },
  {
    id: "credits_200" as const,
    credits: 200,
    amount: 15000,
    eyebrow: "Best Value",
    description: "The strongest value for teams and high-volume AI-assisted work.",
  },
];

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (response: any) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpayCheckout() {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load the secure payment window.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load the secure payment window."));
    document.body.appendChild(script);
  });
}

function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CreditMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5h-5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5h-5" />
      <path d="M12 6v12" />
    </svg>
  );
}

export default function CreditsPage({
  userName,
  userEmail,
  creditsRemaining,
  onCreditsUpdated,
}: {
  userName?: string | null;
  userEmail?: string | null;
  creditsRemaining: number;
  onCreditsUpdated: (credits: number) => void;
}) {
  const [processingPackage, setProcessingPackage] =
    useState<CreditPackageId | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    added: number;
    remaining: number;
  } | null>(null);

  const startPurchase = async (packageId: CreditPackageId) => {
    setError("");
    setSuccess(null);
    setProcessingPackage(packageId);

    try {
      await loadRazorpayCheckout();
      const response = await creditPurchaseService.createOrder(packageId);

      if (!window.Razorpay) {
        throw new Error("The secure payment window is unavailable.");
      }

      const checkout = new window.Razorpay({
        key: response.keyId,
        amount: response.order.amount,
        currency: response.order.currency,
        name: "Lawsuit AI",
        description: `${response.package.credits} AI Credits`,
        order_id: response.order.id,
        prefill: {
          name: userName || undefined,
          email: userEmail || undefined,
        },
        theme: {
          color: "#114C8D",
        },
        retry: {
          enabled: false,
        },
        modal: {
          ondismiss: () => setProcessingPackage(null),
        },
        handler: async (payment: RazorpayResponse) => {
          try {
            const verified = await creditPurchaseService.verifyPayment({
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            });

            onCreditsUpdated(verified.creditsRemaining);
            setSuccess({
              added: verified.creditsAdded,
              remaining: verified.creditsRemaining,
            });
          } catch (verificationError) {
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : "Payment verification failed."
            );
          } finally {
            setProcessingPackage(null);
          }
        },
      });

      checkout.on("payment.failed", (paymentError) => {
        setError(
          paymentError?.error?.description ||
            "The payment was not completed. No credits were added."
        );
        setProcessingPackage(null);
      });

      checkout.open();
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Could not start the credit purchase."
      );
      setProcessingPackage(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#114C8D]">AI Credits</div>
            <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:text-[30px]">
              Choose your credit package
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Select a one-time package. Credits are added to your account immediately after secure payment verification.
            </p>
          </div>

          <div className="w-full rounded-xl border border-[#d9e3ee] bg-white px-4 py-3 sm:w-auto sm:min-w-[190px]">
            <div className="text-xs font-medium text-slate-500">Available balance</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[28px] font-semibold leading-none text-[#114C8D]">
                {creditsRemaining}
              </span>
              <span className="text-sm text-slate-500">credits</span>
            </div>
          </div>
        </div>

        {success && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckIcon />
            </div>
            <div>
              <div className="text-sm font-semibold">Payment completed successfully.</div>
              <div className="mt-0.5 text-sm leading-6 text-emerald-800">
                {success.added} credits were added. Your new balance is {success.remaining} credits.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          {PACKAGES.map((item) => {
            const isProcessing = processingPackage === item.id;

            return (
              <article
                key={item.id}
                className={`relative flex min-h-[360px] flex-col rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition sm:p-6 ${
                  item.featured
                    ? "border-[#114C8D] ring-1 ring-[#114C8D]"
                    : "border-slate-200 hover:border-[#a9bfd6]"
                }`}
              >
                {item.featured && (
                  <div className="absolute right-4 top-4 rounded-full bg-[#114C8D] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    Most Popular
                  </div>
                )}

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4fb] text-[#114C8D]">
                  <CreditMark />
                </div>

                <div className="mt-5 text-sm font-semibold text-slate-700">
                  {item.eyebrow} Package
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-slate-950">
                    {item.credits}
                  </span>
                  <span className="text-sm font-medium text-slate-500">AI credits</span>
                </div>

                <div className="mt-5 border-y border-slate-100 py-4">
                  <div className="text-[28px] font-semibold tracking-[-0.025em] text-[#114C8D]">
                    {formatRupees(item.amount)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">One-time payment</div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  {[
                    "Instant credit activation",
                    "Secure Razorpay checkout",
                    "Valid across all AI tools",
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#edf4fb] text-[#114C8D]">
                        <CheckIcon />
                      </div>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={Boolean(processingPackage)}
                  onClick={() => void startPurchase(item.id)}
                  className={`mt-3.75 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    item.featured
                      ? "bg-[#114C8D] text-white hover:bg-[#0b3a6e]"
                      : "border border-[#114C8D] bg-white text-[#114C8D] hover:bg-[#f2f7fc]"
                  }`}
                >
                  {isProcessing ? "Opening payment..." : "Purchase Package"}
                </button>
              </article>
            );
          })}
        </section>

        <div className="pb-2 pt-5 text-center text-xs leading-5 text-slate-500">
          Credits are added only after the payment is verified successfully.
        </div>
      </div>
    </div>
  );
}
