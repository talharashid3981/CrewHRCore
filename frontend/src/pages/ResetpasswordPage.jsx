import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { resetPassword } from "../api/auth.api";

const controlClass =
  "flex h-[52px] min-w-0 items-center gap-3 rounded-[15px] border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15";

export default function ResetpasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    token ? "" : "This reset link is missing its token.",
  );
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await resetPassword({ token, password });
      setMessage(data.message);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to reset your password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const passwordInput = (value, update, label, placeholder) => (
    <label className="grid gap-2 text-[13px] font-semibold text-slate-700 sm:text-[14px]">
      {label}
      <span className={controlClass}>
        <LockKeyhole size={18} aria-hidden="true" />
        <input
          className="h-full w-full min-w-0 bg-transparent text-[14px] font-normal text-slate-800 outline-none placeholder:text-slate-500"
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => update(event.target.value)}
          placeholder={placeholder}
          minLength={8}
          required
        />
        {label === "New password" && (
          <button
            className="grid size-7 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </span>
    </label>
  );

  return (
    <AuthLayout
      icon={<LockKeyhole size={29} strokeWidth={1.8} />}
      title="Set a new password"
      description="Choose a strong password to secure your Crew HRCore account."
      footer={
        <Link
          className="inline-flex items-center gap-2 font-semibold text-violet-800 transition hover:text-violet-950 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-600"
          to="/login"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        {passwordInput(
          password,
          setPassword,
          "New password",
          "At least 8 characters",
        )}
        {passwordInput(
          confirmPassword,
          setConfirmPassword,
          "Confirm password",
          "Repeat your password",
        )}

        {message && (
          <p
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] leading-5 text-emerald-800"
            role="status"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] leading-5 text-rose-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="mt-1 flex h-14 items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60"
          type="submit"
          disabled={submitting || !token}
        >
          {submitting ? "Saving password..." : "Reset password"}
          <ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
