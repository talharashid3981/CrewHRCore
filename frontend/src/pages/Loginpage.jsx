import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const highlights = [
  {
    title: "Your team, at a glance",
    description: "See attendance and schedules in one place",
  },
  {
    title: "Stay connected",
    description: "Keep up with your team's daily activity",
  },
  {
    title: "Work with confidence",
    description: "Your workspace is ready when you are",
  },
];

// 16px on mobile stops iOS Safari from zooming into the field on focus.
const inputClass =
  "h-full min-w-0 flex-1 bg-transparent text-[16px] font-normal text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-500 sm:text-[14px]";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";

function LoginBrandPanel() {
  return (
    <aside className="relative flex min-h-[230px] min-w-0 flex-col overflow-hidden bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-6 pb-20 pt-6 text-white sm:px-10 lg:min-h-0 lg:px-10 lg:py-9 xl:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[280px] -right-[260px] h-[700px] w-[700px] rounded-full border border-white/15"
      >
        <div className="absolute inset-[90px] rounded-full border border-white/15" />
        <div className="absolute inset-[180px] rounded-full border border-white/15" />
        <div className="absolute inset-[265px] rounded-full border border-white/15" />
      </div>

      <div className="relative flex items-center gap-[14px]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-lg shadow-purple-950/15 ring-1 ring-white/15 lg:h-[50px] lg:w-[50px]">
          <UsersRound size={26} strokeWidth={1.8} className="lg:h-[30px] lg:w-[30px]" />
        </div>
        <span className="font-['Poppins',sans-serif] text-xl font-semibold tracking-tight lg:text-2xl">
          Crew HRCore
        </span>
      </div>

      <div className="relative mt-8 max-w-[440px] lg:mt-10">
        {/* <p>, not a heading: the form's <h1> must be the first heading on the page */}
        <p className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-[1.2] tracking-[-0.6px] sm:text-[26px] lg:text-[34px] lg:leading-[1.16] lg:tracking-[-0.8px] xl:text-[40px]">
          <span className="lg:hidden">
            Attendance you can verify, leave you can plan.
          </span>
          <span className="hidden lg:inline">
            Welcome back to
            <br />
            Crew HRCore.
          </span>
        </p>
        <p className="mt-4 hidden max-w-[410px] text-[15px] leading-[1.65] text-purple-100 sm:text-[16px] lg:block">
          Sign in to your workspace to stay connected with your team and keep
          your workday moving.
        </p>
      </div>

      <div className="relative mt-auto hidden pt-10 lg:block lg:pt-6">
        <div className="rounded-lg bg-white/[0.96] px-5 py-4 text-slate-900 shadow-xl shadow-purple-950/10 sm:px-6 sm:py-5">
          <ul className="divide-y divide-purple-100">
            {highlights.map((highlight, index) => (
              <li
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4"
                key={highlight.title}
              >
                <span
                  className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-['Poppins',sans-serif] text-sm font-semibold ${
                    index === 0
                      ? "bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-md shadow-violet-300"
                      : "bg-purple-100 text-violet-800"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-5 text-slate-900">
                    {highlight.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.4] text-slate-500 sm:text-[13px]">
                    {highlight.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function LoginInput({ children }) {
  return (
    <div className="flex h-11 w-full min-w-0 items-center gap-3 rounded-lg border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15 sm:h-10">
      {children}
    </div>
  );
}

export default function Loginpage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login({ ...formData, rememberMe });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] w-full place-items-center bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-3 py-5 font-['Inter',sans-serif] sm:px-6 sm:py-8 lg:px-8 lg:py-5">
      <section className="grid w-full max-w-[560px] grid-cols-1 overflow-hidden rounded-lg bg-white shadow-[0_40px_90px_rgba(106,13,173,0.18),0_6px_20px_rgba(15,23,42,0.06)] lg:min-h-[max(640px,calc(100dvh_-_2.5rem))] lg:max-w-[1200px] lg:grid-cols-2">
        <LoginBrandPanel />

        <div className="relative z-10 -mt-5 flex min-w-0 items-center justify-center rounded-t-lg bg-white px-5 pb-8 pt-0 sm:px-10 sm:pb-10 lg:mt-0 lg:rounded-none lg:px-10 lg:py-10 xl:px-14">
          <div className="w-full min-w-0 max-w-[400px]">
            <header className="mb-5 text-center lg:mb-6">
              <div className="relative mx-auto -mt-[42px] mb-4 flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-violet-200 text-violet-800 shadow-[0_8px_24px_rgba(106,13,173,0.12)] lg:mt-0 lg:mb-3 lg:h-[72px] lg:w-[72px] lg:shadow-none">
                <LockKeyhole size={40} strokeWidth={1.8} className="lg:h-9 lg:w-9" aria-hidden="true" />
              </div>

              <h1 className="mt-0 font-['Poppins',sans-serif] text-[30px] font-semibold leading-tight tracking-[-0.6px] text-slate-900 lg:mt-2 lg:text-[28px] xl:text-[30px]">
                <span className="lg:hidden">Sign in</span>
                <span className="hidden lg:inline">Welcome back</span>
              </h1>
              <p className="mt-2 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px] lg:mt-1.5 lg:leading-6">
                <span className="lg:hidden">
                  Welcome back. Enter your work email and password to continue.
                </span>
                <span className="hidden lg:inline">
                  Sign in to continue to your Crew HRCore workspace.
                </span>
              </p>
            </header>

            <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-1 gap-3">
              <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
                Email address
                <LoginInput>
                  <Mail size={19} aria-hidden="true" />
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={update}
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                  />
                </LoginInput>
              </label>

              <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
                Password
                <LoginInput>
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    className={inputClass}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={update}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                  />
                  <button
                    className={`-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:text-violet-700 ${focusRing}`}
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </LoginInput>
              </label>

              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1 text-[13px]">
                <label className="flex shrink-0 cursor-pointer items-center gap-2 py-1 text-slate-600">
                  <input
                    className="h-5 w-5 rounded-lg accent-violet-700 lg:h-4 lg:w-4"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  Remember me
                </label>
                <Link
                  className={`shrink-0 whitespace-nowrap py-1 font-medium text-violet-800 hover:text-violet-950 focus-visible:rounded-lg ${focusRing}`}
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <p
                  id="login-error"
                  className="break-words rounded-lg bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                className="mt-1 flex h-11 items-center justify-center gap-3 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-10"
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[13px] text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              <span>Or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="text-center text-[13px] text-slate-600">
              New to Crew HRCore?{" "}
              <Link
                className={`font-semibold text-violet-800 hover:text-violet-950 focus-visible:rounded-lg ${focusRing}`}
                to="/signup"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}