import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  LogOut,
} from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import {
  getOnboardingShiftTimes,
  submitOnboarding,
} from "../api/auth.api";
import useToastMessage from "../hooks/useToastMessage";

const inputClass =
  "h-full w-full min-w-0 bg-transparent text-[14px] font-normal text-slate-800 outline-none placeholder:text-slate-500";
const controlClass =
  "mt-2 flex h-[52px] min-w-0 items-center gap-3 rounded-[15px] border-[1.5px] border-[#E9E5F7] bg-[#FBFAFF] px-4 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.05)] transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15";
const labelClass =
  "block min-w-0 text-[13px] font-semibold text-slate-700 sm:text-[14px]";

function CustomDropdown({
  icon,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  testId,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const selectOption = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative h-full w-full" data-testid={testId}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-full w-full items-center gap-3 text-left text-[14px] text-slate-800 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <span className="shrink-0 text-violet-600">{icon}</span>
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-violet-700" : "text-slate-400"}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-72 w-full overflow-y-auto rounded-[14px] border border-violet-100 bg-white p-1.5 shadow-[0_16px_40px_rgba(76,29,149,0.16)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.value}
                onClick={() => selectOption(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] transition ${
                  isSelected
                    ? "bg-violet-50 font-semibold text-violet-800"
                    : "font-normal text-slate-700 hover:bg-slate-50 hover:text-violet-800"
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected && <Check size={16} className="shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({
    jobTitle: user?.designation || "",
    department: user?.department || "",
    shift: user?.shift || "AM",
    joiningDate: user?.joiningDate
      ? new Date(user.joiningDate).toISOString().slice(0, 10)
      : "",
  });
  const [shifts, setShifts] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useToastMessage(shiftError, "error");
  useToastMessage(error, "error");
  useToastMessage(
    user?.onboardingStatus === "rejected"
      ? user.rejectionNote || "Your onboarding needs changes. Please update your details and resubmit."
      : "",
    "warning",
  );

  const loadShifts = useCallback(async () => {
    setShiftError("");
    setShiftsLoading(true);
    try {
      const result = await getOnboardingShiftTimes();
      setShifts(result.shifts);
      const configuredDepartments = result.departments || [];
      setDepartments(configuredDepartments);
      setForm((current) => ({
        ...current,
        department: configuredDepartments.includes(current.department)
          ? current.department
          : "",
      }));
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
    if (!form.department) {
      setError("Department is required");
      return;
    }
    if (!form.joiningDate) {
      setError("Joining date is required");
      return;
    }
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
            <CustomDropdown
              icon={<Building2 size={18} aria-hidden="true" />}
              testId="department-dropdown"
              value={form.department}
              options={departments.map((department) => ({
                value: department,
                label: department,
              }))}
              placeholder={
                shiftsLoading
                  ? "Loading departments..."
                  : departments.length
                    ? "Select a department"
                    : "No departments available"
              }
              onChange={(department) =>
                setForm((current) => ({ ...current, department }))
              }
              disabled={shiftsLoading || departments.length === 0}
            />
          </span>
          <span className="mt-1.5 block min-h-5 text-[11px] font-normal leading-4 text-slate-500">
            {/* {shiftsLoading ? "Loading departments configured by your administrator..." : departments.length ? "Choose from the departments configured by your administrator." : "Your administrator needs to configure a department before you can submit onboarding."} */}
          </span>
        </label>

        <label className={labelClass}>
          Shift
          <span className={controlClass}>
            <CustomDropdown
              icon={<Clock3 size={18} aria-hidden="true" />}
              testId="shift-dropdown"
              value={form.shift}
              options={["AM", "PM"].map((shift) => ({
                value: shift,
                label: shiftLabel(shift),
              }))}
              placeholder="Select a shift"
              onChange={(shift) =>
                setForm((current) => ({ ...current, shift }))
              }
            />
          </span>
          {/* <span className="mt-1.5 flex min-h-5 items-center gap-1.5 text-[11px] font-normal leading-4 text-slate-500">
            {shiftsLoading ? (
              <>
                <LoaderCircle
                  size={12}
                  className="shrink-0 animate-spin text-violet-600"
                />
                Loading organization shift hours…
              </>
            ) : (
              // "Your selected hours are applied after approval."
            )}
          </span> */}
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
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-violet-800 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              onClick={() => void loadShifts()}
            >
              Retry loading shift hours
            </button>
          </div>
        )}

        <button
          className="sm:col-span-2 mt-1 flex h-14 items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(106,13,173,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(106,13,173,0.36)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60"
          disabled={saving || shiftsLoading || departments.length === 0}
        >
          {saving ? "Submitting..." : "Submit for approval"}
          <ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
