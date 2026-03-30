import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "register";

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

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7a3 3 0 0 0 4 4" />
      <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.2" />
      <path d="M6.7 6.7C4 8.5 2 12 2 12a17.8 17.8 0 0 0 5.2 5.3A10.7 10.7 0 0 0 12 19c1 0 2-.1 2.9-.4" />
    </svg>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  icon,
  required,
  rightSlot,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon: React.ReactNode;
  required?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
        <div className="text-slate-400">{icon}</div>

        <input
          value={value}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          placeholder={placeholder}
          required={required}
        />

        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
  );
}

export default function AuthScreen() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Sign in to continue your saved research, case summaries, bookmarks, and legal workspace."
        : "Create an account to save chats, bookmark cases, and build your legal research history.",
    [mode]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(17,76,141,0.08),_transparent_32%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden lg:block">
            <div className="max-w-xl">
              <div className="mb-2 w-[300px] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
                <img className="w-full" src="/logo.png" alt="" />
              </div>

              <h1 className="text-[clamp(38px,5vw,64px)] font-semibold leading-[1.04] tracking-tight text-slate-950">
                Research cases faster, deeper, and with more clarity.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-8 text-slate-600">
                Save conversations, generate structured case summaries, bookmark
                authorities, and explore judgments in a cleaner legal research
                workflow.
              </p>

              <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 backdrop-blur">
                  <div className="text-sm font-semibold text-slate-900">
                    Saved case summaries
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    Reuse structured summaries instead of regenerating the same
                    case analysis again and again.
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 backdrop-blur">
                  <div className="text-sm font-semibold text-slate-900">
                    Case-specific AI chat
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    Dive deep into a single judgment with grounded answers tied
                    only to that case.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[460px]">
            <div className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_30px_120px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
              <div className="mb-8">
                <div className="mb-5 flex items-center gap-3 lg:hidden">
                  <LogoIcon />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Lawsuit AI
                    </div>
                    <div className="text-xs text-slate-500">
                      Legal research workspace
                    </div>
                  </div>
                  
                </div>
                

                <div className="mb-4 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  {mode === "login" ? "Sign in" : "Register"}
                </div>

                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {title}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {subtitle}
                </p>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    mode === "register"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "register" ? (
                  <InputField
                    label="Full name"
                    placeholder="Your name"
                    value={name}
                    onChange={setName}
                    icon={<UserIcon />}
                    required
                  />
                ) : null}

                <InputField
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  icon={<MailIcon />}
                  required
                />

                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={setPassword}
                  type={showPassword ? "text" : "password"}
                  icon={<LockIcon />}
                  required
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="cursor-pointer text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  }
                />

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-2xl bg-[#114C8D] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0B3A6E] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                    ? "Login"
                    : "Create account"}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-5 text-center text-xs leading-6 text-slate-500">
                By continuing, you’re entering your private legal research
                workspace.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}