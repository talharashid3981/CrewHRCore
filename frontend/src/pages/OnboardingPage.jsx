import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  LogOut,
} from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import {
  getOnboardingShiftTimes,
  submitOnboarding,
} from "../api/auth.api";

const inputClass =
  "h-full w-full min-w-0 bg-transparent text-[14px] font-normal text-slate-800 outline-none placeholder:text-slate-500";
const controlClass =
  "mt-2 flex h-[52px] min-w-0 items-center gap-3 rounded-[15px] border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15";
const labelClass =
  "block min-w-0 text-[13px] font-semibold text-slate-700 sm:text-[14px]";

export default function OnboardingPage() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({
    jobTitle: user?.designation || "",
    department: user?.department === "General" ? "" : user?.department || "",
    shift: user?.shift || "AM",
    joiningDate: user?.joiningDate
      ? new Date(user.joiningDate).toISOString().slice(0, 10)
      : "",
  });
  const [shifts, setShifts] = useState(null);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadShifts = useCallback(async () => {
    setShiftError("");
    setShiftsLoading(true);
    try {
      const result = await getOnboardingShiftTimes();
      setShifts(result.shifts);
    } catch (requestError) {
      setShiftError(
        requestError.response?.data?.message ||
          "Unable to load current shift hours.",
      );
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadShifts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadShifts]);

  const update = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  if (user?.onboardingStatus === "pending") {
    return (
      <AuthLayout
        icon={<ClipboardCheck size={30} strokeWidth={1.8} />}
        title="Waiting for approval"
        description="Your onboarding details have been submitted. An administrator will review them shortly."
        footer={
          <button
            className="inline-flex items-center gap-2 font-semibold text-slate-600 transition hover:text-violet-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-600"
            onClick={logout}
            type="button"
          >
            <LogOut size={16} />
            Sign out
          </button>
        }
      >
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-center">
          <p className="text-[13px] leading-5 text-violet-900">
            You’ll be able to access attendance and leave tools once your
            profile is approved.
          </p>
        </div>
      </AuthLayout>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await submitOnboarding(form);
      updateUser(data.user);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit onboarding",
      );
    } finally {
      setSaving(false);
    }
  };

  const shiftLabel = (shift) => {
    const schedule = shifts?.[shift];
    return schedule
      ? `${shift} shift · ${schedule.shiftStart}–${schedule.shiftEnd}`
      : `${shift} shift`;
  };

  return (
    <AuthLayout
      icon={<ClipboardCheck size={30} strokeWidth={1.8} />}
      title="Complete your profile"
      description="Add your work details and choose the shift that fits your schedule."
      footer={
        <button
          className="inline-flex items-center gap-2 font-semibold text-slate-600 transition hover:text-violet-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-600"
          onClick={logout}
          type="button"
        >
          <LogOut size={16} />
          Sign out
        </button>
      }
    >
      {user?.onboardingStatus === "rejected" && (
        <p
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] leading-5 text-rose-700"
          role="alert"
        >
          Admin note: {user.rejectionNote}
        </p>
      )}

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className={labelClass}>
          Job title
          <span className={controlClass}>
            <BriefcaseBusiness size={18} aria-hidden="true" />
            <input
              className={inputClass}
              name="jobTitle"
              type="text"
              value={form.jobTitle}
              onChange={update}
              required
              placeholder="e.g. Product Designer"
            />
          </span>
        </label>

        <label className={labelClass}>
          Department
          <span className={controlClass}>
            <Building2 size={18} aria-hidden="true" />
            <input
              className={inputClass}
              name="department"
              type="text"
              value={form.department}
              onChange={update}
              required
              placeholder="e.g. Operations"
            />
          </span>
        </label>

        <label className={labelClass}>
          Shift
          <span className={controlClass}>
            <Clock3 size={18} aria-hidden="true" />
            <select
              className={inputClass}
              name="shift"
              value={form.shift}
              onChange={update}
            >
              <option value="AM">{shiftLabel("AM")}</option>
              <option value="PM">{shiftLabel("PM")}</option>
            </select>
          </span>
          <span className="mt-1.5 flex min-h-5 items-center gap-1.5 text-[11px] font-normal leading-4 text-slate-500">
            {shiftsLoading ? (
              <>
                <LoaderCircle
                  size={12}
                  className="shrink-0 animate-spin text-violet-600"
                />
                Loading organization shift hours…
              </>
            ) : (
              "Your selected hours are applied after approval."
            )}
          </span>
        </label>

        <label className={labelClass}>
          Joining date
          <span className={controlClass}>
            <CalendarDays size={18} aria-hidden="true" />
            <input
              className={inputClass}
              name="joiningDate"
              type="date"
              value={form.joiningDate}
              onChange={update}
              required
            />
          </span>
        </label>

        {shiftError && (
          <p
            className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800"
            role="alert"
          >
            <span>{shiftError}</span>
            <button
              type="button"
              className="shrink-0 font-semibold text-violet-800 hover:text-violet-950"
              onClick={() => void loadShifts()}
            >
              Retry
            </button>
          </p>
        )}

        {error && (
          <p
            className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] leading-5 text-rose-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="sm:col-span-2 mt-1 flex h-14 items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Submitting..." : "Submit for approval"}
          <ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
