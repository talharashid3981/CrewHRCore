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
import useToastMessage from "../hooks/useToastMessage";

const controlClass =
  "flex h-11 min-w-0 items-center gap-3 rounded-lg border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15 sm:h-10";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";

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
  useToastMessage(message, "success");
  useToastMessage(error, "error");

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

  const passwordInput = (value, update, label, placeholder, name) => (
    <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
      {label}
      <span className={controlClass}>
        <LockKeyhole size={18} aria-hidden="true" />
        <input
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-normal text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-500 sm:text-[14px]"
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => update(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          minLength={8}
          aria-invalid={Boolean(error)}
          aria-describedby={label === "New password" ? "password-help" : undefined}
          required
        />
        {label === "New password" && (
          <button
            className={`-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:text-violet-700 ${focusRing}`}
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
      {label === "New password" && (
        <span
          id="password-help"
          className="text-[12px] font-normal text-slate-500"
        >
          Use at least 8 characters.
        </span>
      )}
    </label>
  );

  return (
    <AuthLayout
      variant="login"
      icon={<LockKeyhole size={40} strokeWidth={1.8} aria-hidden="true" />}
      title="Set a new password"
      description="Choose a strong password to secure your Crew HRCore account."
      footer={
        <Link
          className={`inline-flex items-center gap-2 font-medium text-violet-800 transition hover:text-violet-950 focus-visible:rounded-lg ${focusRing}`}
          to="/login"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="grid min-w-0 grid-cols-1 gap-3"
      >
        {passwordInput(
          password,
          setPassword,
          "New password",
          "At least 8 characters",
          "password",
        )}
        {passwordInput(
          confirmPassword,
          setConfirmPassword,
          "Confirm password",
          "Repeat your password",
          "confirmPassword",
        )}
        <button
          className="mt-1 flex h-11 items-center justify-center gap-3 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-10"
          type="submit"
          disabled={submitting || !token}
          aria-busy={submitting}
        >
          {submitting ? "Saving password..." : "Reset password"}
          <ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
