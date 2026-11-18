import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const steps = [
  {
    title: "Create your account",
    description: "Name, email and password",
  },
  {
    title: "Complete your profile",
    description: "Job title, department and shift",
  },
  {
    title: "Get approved",
    description: "An administrator reviews your details",
  },
];

const inputClass =
  "h-full min-w-0 flex-1 bg-transparent text-[14px] font-normal text-slate-800 outline-none placeholder:text-[14px] placeholder:font-normal placeholder:text-slate-500";

function SignupBrandPanel() {
  return (
    <aside className="relative flex h-[230px] min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-6 py-6 text-white sm:px-10 lg:h-auto lg:min-h-0 lg:px-10 lg:py-9 xl:px-12">
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
        <h2 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-[1.2] tracking-[-0.6px] sm:text-[26px] lg:text-[34px] lg:leading-[1.16] lg:tracking-[-0.8px] xl:text-[40px]">
          Join your team on
          <br />
          Crew HRCore.
        </h2>
        <p className="mt-4 hidden max-w-[410px] text-[15px] leading-[1.65] text-purple-100 sm:text-[16px] lg:block">
          Set up your account in a minute. Your administrator reviews your
          profile before you start checking in.
        </p>
      </div>

      <div className="relative mt-auto hidden pt-10 lg:block lg:pt-6">
        <div className="rounded-lg bg-white/[0.96] px-5 py-4 text-slate-900 shadow-xl shadow-purple-950/10 sm:px-6 sm:py-5">
          <ol className="divide-y divide-purple-100">
            {steps.map((step, index) => (
              <li
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4"
                key={step.title}
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
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.4] text-slate-500 sm:text-[13px]">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}

function SignupInput({ children, className = "" }) {
  return (
    <div
      className={`flex h-10 w-full min-w-0 items-center gap-3 rounded-lg border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15 ${className}`}
    >
      {children}
    </div>
  );
}

export default function Signuppage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
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
      await register({
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
      });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen w-full place-items-center bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-3 py-5 font-['Inter',sans-serif] sm:px-6 sm:py-8 lg:h-screen lg:overflow-hidden lg:px-8 lg:py-5">
      <section className="grid w-full max-w-[1200px] grid-cols-1 overflow-hidden rounded-[30px] bg-white shadow-[0_40px_90px_rgba(106,13,173,0.18),0_6px_20px_rgba(15,23,42,0.06)] sm:rounded-3xl lg:h-full lg:grid-cols-2">
        <SignupBrandPanel />

        <div className="relative z-10 -mt-10 flex min-w-0 items-center justify-center rounded-t-[32px] bg-white px-5 pb-8 pt-0 sm:px-10 sm:pb-10 sm:pt-0 lg:mt-0 lg:min-h-0 lg:overflow-y-auto lg:rounded-none lg:px-10 lg:py-4 xl:px-14">
          <div className="w-full min-w-0 max-w-[400px]">
            <header className="mb-5 text-center lg:mb-4">
              <div
                className="relative mx-auto -mt-[42px] mb-4 flex h-[84px] w-[84px] items-center justify-center rounded-full text-violet-800 shadow-[0_8px_24px_rgba(106,13,173,0.12)] lg:mt-0 lg:mb-2 lg:h-[72px] lg:w-[72px] lg:shadow-none"
                style={{
                  background:
                    "linear-gradient(to bottom right, #EDE9FE, #DDD6FE)",
                  flexShrink: 0,
                }}
              >
                <UserRound
                  size={46}
                  strokeWidth={1.9}
                  fill="currentColor"
                  className="lg:h-10 lg:w-10"
                />

                <span className="absolute -right-1 top-0 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-md">
                  <Plus size={15} strokeWidth={2.5} />
                </span>
              </div>

              <h1 className="mt-0 font-['Poppins',sans-serif] text-[30px] font-semibold leading-tight tracking-[-0.6px] text-slate-900 lg:mt-2 lg:text-[28px] xl:text-[30px]">
                Create your account
              </h1>
              <p className="mt-2 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px] lg:mt-1.5 lg:leading-6">
                Sign up to get started with your workspace.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-1 gap-3">
              <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
                Full name
                <SignupInput>
                  <UserRound size={19} aria-hidden="true" />
                  <input
                    className={inputClass}
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={update}
                    placeholder="Your full name"
                    autoComplete="name"
                    minLength={2}
                    required
                  />
                </SignupInput>
              </label>

              <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
                Work email
                <SignupInput>
                  <Mail size={19} aria-hidden="true" />
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={update}
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                  />
                </SignupInput>
              </label>

              <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
                Password
                <SignupInput>
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    className={inputClass}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={update}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    className="shrink-0 text-slate-500 transition hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </SignupInput>
                <span className="text-[12px] font-normal text-slate-500">
                  Use at least 8 characters.
                </span>
              </label>

              {error && (
                <p
                  className="rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                className="flex h-10  items-center justify-center gap-3 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Creating account..." : "Create account"}
                <ChevronRight size={18} />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[13px] text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              <span>Or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="text-center text-[13px] text-slate-600">
              Already have an account?{" "}
              <Link
                className="font-medium text-violet-800 hover:text-violet-950 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
