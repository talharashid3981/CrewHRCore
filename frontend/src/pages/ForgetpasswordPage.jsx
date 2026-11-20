import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { forgotPassword } from "../api/auth.api";
import useToastMessage from "../hooks/useToastMessage";

const controlClass =
  "flex h-11 min-w-0 items-center gap-3 rounded-lg border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15 sm:h-10";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";

export default function ForgetpasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastMessage(message, "success");
  useToastMessage(error, "error");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send the reset link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      variant="login"
      icon={<ShieldCheck size={40} strokeWidth={1.8} aria-hidden="true" />}
      title="Reset your password"
      description="Enter your work email and we’ll send you a secure reset link."
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
        <label className="grid min-w-0 grid-cols-1 gap-1 text-[14px] font-semibold text-slate-700">
          Email address
          <span className={controlClass}>
            <Mail size={19} aria-hidden="true" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-normal text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-500 sm:text-[14px]"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              required
            />
          </span>
        </label>

        <button
          className="mt-1 flex h-11 items-center justify-center gap-3 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-10"
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Sending link..." : "Send reset link"}
          <ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
