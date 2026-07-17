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
    <div className="min-h-full overflow-y-auto bg-[#f7f9fc]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="relative overflow-hidden rounded-[30px] border border-[#dbe5f0] bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,35,65,0.08)] sm:px-9 lg:px-12 lg:py-11">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#e8f1fb] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#eef4fa] blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#cfe0f2] bg-[#f4f8fc] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#114C8D]">
                <CreditMark />
                AI Credit Store
              </div>
              <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-[44px] lg:text-[52px]">
                Keep your legal AI workspace moving.
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600 sm:text-[17px]">
                Purchase a credit package and continue using Judgment Mode,
                Drafting Studio, and the rest of the Lawsuit AI tools.
              </p>
            </div>

            <div className="min-w-[220px] rounded-[22px] border border-[#d8e3ee] bg-[#f8fafc] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Current balance
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-[#114C8D]">
                  {creditsRemaining}
                </span>
                <span className="pb-1 text-sm font-medium text-slate-500">
                  credits
                </span>
              </div>
            </div>
          </div>
        </section>

        {success && (
          <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckIcon />
            </div>
            <div>
              <div className="font-semibold">Payment completed successfully.</div>
              <div className="mt-1 text-sm leading-6 text-emerald-800">
                {success.added} credits were added. Your new balance is {success.remaining} credits.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-800">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {PACKAGES.map((item) => {
            const isProcessing = processingPackage === item.id;

            return (
              <article
                key={item.id}
                className={`relative flex min-h-[430px] flex-col overflow-hidden rounded-[28px] border p-7 transition duration-200 sm:p-8 ${
                  item.featured
                    ? "border-[#114C8D] bg-[#0b3769] text-white shadow-[0_28px_70px_rgba(17,76,141,0.22)] lg:-translate-y-3"
                    : "border-[#dbe4ee] bg-white text-slate-950 shadow-[0_18px_50px_rgba(15,35,65,0.06)] hover:-translate-y-1 hover:border-[#b9cde2]"
                }`}
              >
                {item.featured && (
                  <div className="absolute right-5 top-5 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white ring-1 ring-white/20">
                    Recommended
                  </div>
                )}

                <div
                  className={`text-xs font-semibold uppercase tracking-[0.17em] ${
                    item.featured ? "text-blue-100" : "text-[#114C8D]"
                  }`}
                >
                  {item.eyebrow}
                </div>

                <div className="mt-7">
                  <div className="flex items-end gap-2">
                    <span className="text-[56px] font-semibold leading-none tracking-[-0.055em]">
                      {item.credits}
                    </span>
                    <span
                      className={`pb-2 text-sm font-medium ${
                        item.featured ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      AI Credits
                    </span>
                  </div>
                  <div className="mt-5 text-[32px] font-semibold tracking-[-0.035em]">
                    {formatRupees(item.amount)}
                  </div>
                </div>

                <p
                  className={`mt-5 text-[15px] leading-7 ${
                    item.featured ? "text-blue-50/85" : "text-slate-600"
                  }`}
                >
                  {item.description}
                </p>

                <div
                  className={`my-7 h-px ${
                    item.featured ? "bg-white/15" : "bg-slate-200"
                  }`}
                />

                <div className="space-y-3 text-sm">
                  {["Instant credit addition", "Secure online payment", "Use across all AI tools"].map(
                    (benefit) => (
                      <div key={benefit} className="flex items-center gap-3">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            item.featured
                              ? "bg-white/12 text-white"
                              : "bg-[#eaf2fa] text-[#114C8D]"
                          }`}
                        >
                          <CheckIcon />
                        </div>
                        <span>{benefit}</span>
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={Boolean(processingPackage)}
                  onClick={() => void startPurchase(item.id)}
                  className={`mt-auto inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    item.featured
                      ? "bg-white text-[#0b3769] hover:bg-blue-50"
                      : "bg-[#114C8D] text-white hover:bg-[#0b3a6e]"
                  }`}
                >
                  {isProcessing ? "Opening secure payment..." : `Buy ${item.credits} Credits`}
                </button>
              </article>
            );
          })}
        </section>

        <div className="mt-5 text-center text-xs leading-5 text-slate-500">
          Credits are added only after the payment is securely verified.
        </div>
      </div>
    </div>
  );
}
