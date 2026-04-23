function LogoIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#114C8D] text-white">
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 4 7l8 4 8-4-8-4Z" />
        <path d="M6 10v4c0 2.2 2.7 4 6 4s6-1.8 6-4v-4" />
        <path d="M20 7v6" />
      </svg>
    </div>
  );
}

export default function AuthScreen() {
  const caseFinderUrl =
    import.meta.env.VITE_CF_LOGIN_URL ||
    import.meta.env.VITE_CF_BASE_URL ||
    "#";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-[1100px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between bg-gradient-to-br from-[#0F4C8D] via-[#114C8D] to-[#0A2D52] p-8 text-white sm:p-10">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/90">
                LawSuit AI
              </div>

              <h1 className="mt-8 max-w-[440px] text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
                Access is now handled only through LawSuit Case Finder
              </h1>

              <p className="mt-5 max-w-[440px] text-[15px] leading-7 text-white/80">
                Direct login and registration on this AI app have been disabled.
                Users must sign in through LawSuit Case Finder and will be
                redirected here automatically through SSO.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Secure access
                </div>
                <div className="mt-2 text-sm leading-6 text-white/85">
                  Authentication now happens centrally through the parent
                  platform.
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Seamless entry
                </div>
                <div className="mt-2 text-sm leading-6 text-white/85">
                  Open AI from LawSuit Case Finder and continue directly without
                  separate credentials.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-8 sm:p-10">
            <div className="w-full max-w-[440px]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-4">
                  <LogoIcon />
                  <div>
                    <div className="text-[22px] font-semibold text-slate-900">
                      SSO only
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Sign in through LawSuit Case Finder
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm leading-7 text-slate-700">
                  To continue, go back to LawSuit Case Finder, sign in there,
                  and open the AI section from inside the platform.
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!caseFinderUrl || caseFinderUrl === "#") return;
                      window.location.href = caseFinderUrl;
                    }}
                    className="cursor-pointer inline-flex w-full items-center justify-center rounded-2xl bg-[#114C8D] px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#0B3A6E]"
                  >
                    Go to LawSuit Case Finder
                  </button>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                    This page no longer supports direct login or registration.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

