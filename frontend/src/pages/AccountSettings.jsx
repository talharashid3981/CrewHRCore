import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  UserRound,
} from "lucide-react";
import dayjs from "dayjs";
import { changeMyPassword, updateMyProfile } from "../api/auth.api";

const cardClass =
  "rounded-2xl border border-[#EDF0F6] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]";
const preferenceKey = "crew-hrcore-notification-preferences";
const defaultPreferences = {
  leaveUpdates: true,
  attendanceReminders: true,
  weeklySummary: false,
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "Enter a new password" };
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return {
    score,
    label: ["Weak", "Fair", "Good", "Strong"][Math.max(0, score - 1)],
  };
};

function ReadOnlyValue({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <Icon className="shrink-0 text-violet-500" size={15} />
      <span className="min-w-0">
        <span className="block text-[10px] text-slate-500">{label}</span>
        <span className="block truncate text-[12px] font-semibold text-slate-800">
          {value || "Not provided"}
        </span>
      </span>
      <LockKeyhole className="ml-auto shrink-0 text-slate-300" size={13} />
    </div>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block min-w-0 text-[11px] font-semibold text-slate-700">
      {label}
      <span className="mt-1.5 flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-[#E9E5F7] bg-[#FBFAFF] px-3 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.04)] transition focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
        <LockKeyhole className="shrink-0" size={15} />
        <input
          autoComplete={autoComplete}
          className="h-full w-full min-w-0 bg-transparent text-[12px] font-normal text-slate-800 outline-none placeholder:text-slate-400"
          onChange={onChange}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-700"
          onClick={onToggle}
          type="button"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );
}

export default function AccountSettings({ user, updateUser, onSignOut }) {
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    profilePic: user?.profilePic || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [initialPreferences] = useState(() => {
    try {
      const saved = window.localStorage.getItem(preferenceKey);
      if (!saved) return { preferences: defaultPreferences, error: "" };
      const parsed = JSON.parse(saved);
      return {
        preferences: {
          leaveUpdates: parsed.leaveUpdates !== false,
          attendanceReminders: parsed.attendanceReminders !== false,
          weeklySummary: parsed.weeklySummary === true,
        },
        error: "",
      };
    } catch {
      return {
        preferences: defaultPreferences,
        error: "Could not load notification preferences from this browser.",
      };
    }
  });
  const [preferences, setPreferences] = useState(initialPreferences.preferences);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState(initialPreferences.error);
  const [notice, setNotice] = useState("");
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");

  const strength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword],
  );
  const isProfileDirty =
    profileForm.name !== (user?.name || "") ||
    profileForm.profilePic !== (user?.profilePic || "");
  const joinedDate = user?.joiningDate
    ? dayjs(user.joiningDate).format("DD MMM YYYY")
    : "Not provided";
  const shift = user?.shiftStart && user?.shiftEnd
    ? `${user.shiftStart} – ${user.shiftEnd}`
    : user?.shift || "Not provided";
  const statusLabel = user?.onboardingStatus
    ? `${user.onboardingStatus[0].toUpperCase()}${user.onboardingStatus.slice(1)}`
    : "Active";

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const name = profileForm.name.trim();
    const profilePic = profileForm.profilePic.trim();
    if (name.length < 2) {
      setError("Your name must contain at least 2 characters.");
      return;
    }
    if (profilePic) {
      try {
        const photoUrl = new URL(profilePic);
        if (!["http:", "https:"].includes(photoUrl.protocol)) {
          throw new Error("Unsupported photo URL protocol");
        }
      } catch {
        setError("Enter a valid HTTPS or HTTP image URL.");
        return;
      }
    }

    setSavingProfile(true);
    try {
      const profile = { name };
      if (profilePic) profile.profilePic = profilePic;
      const result = await updateMyProfile(profile);
      updateUser(result.user);
      setProfileForm({
        name: result.user.name || "",
        profilePic: result.user.profilePic || "",
      });
      setNotice(result.message || "Profile updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update your profile. Please try again.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Your new password and confirmation do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setError("Your new password must have at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await changeMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setNotice(result.message || "Password changed successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to change your password. Please try again.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const togglePreference = (key) => {
    const next = { ...preferences, [key]: !preferences[key] };
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      setPreferences(next);
      setError("");
    } catch {
      setError("Could not save preferences in this browser.");
    }
  };

  const togglePasswordVisibility = (key) =>
    setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }));

  const preferenceItems = [
    {
      key: "leaveUpdates",
      title: "Leave updates",
      description: "When a request is approved or rejected.",
    },
    {
      key: "attendanceReminders",
      title: "Attendance reminders",
      description: "Check-in and check-out reminders.",
    },
    {
      key: "weeklySummary",
      title: "Weekly summary",
      description: "A digest of your activity each week.",
    },
  ];

  return (
    <main
      className="@container/account w-full min-w-0 max-w-full overflow-x-clip text-slate-800"
      aria-labelledby="account-settings-title"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1
              className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-0.5px] text-slate-900"
              id="account-settings-title"
            >
              Account settings
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Manage your profile, password and preferences.
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
            onClick={onSignOut}
            type="button"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </header>

        {error && (
          <p
            className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] text-rose-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="mb-3 inline-flex w-full items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700"
            role="status"
          >
            <CheckCircle2 size={15} />
            {notice}
          </p>
        )}

        <div className="grid min-w-0 items-start gap-4 @min-[460px]/account:grid-cols-2 @min-[1000px]/account:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="grid min-w-0 grid-cols-1 gap-4">
            <section className={`${cardClass} overflow-hidden`}>
              <div className="bg-gradient-to-b from-purple-100 via-purple-50 to-white px-4 pb-4 pt-5 text-center">
                <div className="relative mx-auto grid h-[76px] w-[76px] place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-800 font-['Poppins',sans-serif] text-[24px] font-semibold text-white shadow-[0_8px_20px_rgba(106,13,173,0.22)] ring-4 ring-white">
                  {profileForm.profilePic &&
                  profileForm.profilePic !== failedAvatarUrl ? (
                    <img
                      alt={`${profileForm.name || "User"} profile`}
                      className="h-full w-full rounded-full object-cover"
                      onError={() => setFailedAvatarUrl(profileForm.profilePic)}
                      src={profileForm.profilePic}
                    />
                  ) : (
                    initials(profileForm.name)
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-white text-violet-600 shadow-sm">
                    <UserRound size={14} />
                  </span>
                </div>
                <h2 className="mt-3 truncate font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">
                  {user?.name || "Your profile"}
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {user?.email}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[9px] font-semibold text-violet-700">
                    {user?.role === "admin" ? "Administrator" : "Employee"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <BadgeCheck size={11} />
                    {statusLabel}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="text-[10px] leading-4 text-slate-500">
                  Update your photo by entering an image URL in Personal
                  information.
                </p>
              </div>
            </section>

            <section className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                  Work details
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-[9px] font-semibold text-violet-700">
                  <LockKeyhole size={10} />
                  Read-only
                </span>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                <ReadOnlyValue
                  icon={BriefcaseBusiness}
                  label="Job title"
                  value={user?.designation}
                />
                <ReadOnlyValue
                  icon={Building2}
                  label="Department"
                  value={user?.department}
                />
                <ReadOnlyValue
                  icon={Clock3}
                  label="Shift"
                  value={shift}
                />
                <ReadOnlyValue
                  icon={CalendarDays}
                  label="Joined"
                  value={joinedDate}
                />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-purple-50 px-3 py-2.5 text-[10px] leading-4 text-violet-700">
                <Info className="mt-0.5 shrink-0" size={13} />
                Managed by your administrator. Contact HR if something is
                incorrect.
              </div>
            </section>

          </aside>

          <div className="grid min-w-0 gap-4">
            <section className={`${cardClass} p-4 sm:p-5`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                    Personal information
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Update the details you&apos;re allowed to change.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-medium text-slate-500">
                  <LockKeyhole size={10} />
                  Work email is read-only
                </span>
              </div>
              <form onSubmit={saveProfile}>
                <div className="grid min-w-0 gap-3 @min-[520px]/account:grid-cols-2">
                  <label className="block min-w-0 text-[11px] font-semibold text-slate-700">
                    Full name
                    <span className="mt-1.5 flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-[#E9E5F7] bg-[#FBFAFF] px-3 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.04)] transition focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
                      <UserRound className="shrink-0" size={15} />
                      <input
                        autoComplete="name"
                        className="h-full w-full min-w-0 bg-transparent text-[12px] font-normal text-slate-800 outline-none"
                        maxLength={100}
                        minLength={2}
                        onChange={(event) =>
                          setProfileForm({
                            ...profileForm,
                            name: event.target.value,
                          })
                        }
                        required
                        value={profileForm.name}
                      />
                    </span>
                  </label>
                  <label className="block min-w-0 text-[11px] font-semibold text-slate-700">
                    Work email
                    <span className="mt-1.5 flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-[#E9E5F7] bg-slate-50 px-3 text-slate-400">
                      <Mail className="shrink-0 text-violet-500" size={15} />
                      <input
                        className="h-full w-full min-w-0 bg-transparent text-[12px] font-normal text-slate-600 outline-none"
                        readOnly
                        value={user?.email || ""}
                      />
                    </span>
                  </label>
                  <label className="block min-w-0 text-[11px] font-semibold text-slate-700 sm:col-span-2">
                    Profile photo URL
                    <span className="mt-1.5 flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-[#E9E5F7] bg-[#FBFAFF] px-3 text-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.04)] transition focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
                      <UserRound className="shrink-0" size={15} />
                      <input
                        autoComplete="url"
                        className="h-full w-full min-w-0 bg-transparent text-[12px] font-normal text-slate-800 outline-none placeholder:text-slate-400"
                        maxLength={2048}
                        onChange={(event) =>
                          setProfileForm({
                            ...profileForm,
                            profilePic: event.target.value,
                          })
                        }
                        placeholder="https://example.com/photo.jpg"
                        type="url"
                        value={profileForm.profilePic}
                      />
                    </span>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={!isProfileDirty || savingProfile}
                    onClick={() =>
                      setProfileForm({
                        name: user?.name || "",
                        profilePic: user?.profilePic || "",
                      })
                    }
                    type="button"
                  >
                    Reset
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] px-4 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!isProfileDirty || savingProfile}
                    type="submit"
                  >
                    {savingProfile ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </section>

            <section className={`${cardClass} p-4 sm:p-5`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                    Change password
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Choose a strong password you don&apos;t use elsewhere.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[9px] font-medium text-violet-700">
                  <KeyRound size={10} />
                  Secure update
                </span>
              </div>
              <form onSubmit={changePassword}>
                <div className="grid min-w-0 gap-3 @min-[520px]/account:grid-cols-2 @min-[800px]/account:grid-cols-3">
                  <PasswordInput
                    autoComplete="current-password"
                    label="Current password"
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: event.target.value,
                      })
                    }
                    onToggle={() => togglePasswordVisibility("current")}
                    value={passwordForm.currentPassword}
                    visible={visiblePasswords.current}
                  />
                  <PasswordInput
                    autoComplete="new-password"
                    label="New password"
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: event.target.value,
                      })
                    }
                    onToggle={() => togglePasswordVisibility("new")}
                    value={passwordForm.newPassword}
                    visible={visiblePasswords.new}
                  />
                  <PasswordInput
                    autoComplete="new-password"
                    label="Confirm new password"
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: event.target.value,
                      })
                    }
                    onToggle={() => togglePasswordVisibility("confirm")}
                    value={passwordForm.confirmPassword}
                    visible={visiblePasswords.confirm}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div
                    aria-label={`Password strength: ${strength.label}`}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((item) => (
                        <span
                          className={`h-1.5 w-7 rounded-full ${
                            item < strength.score
                              ? strength.score < 2
                                ? "bg-rose-400"
                                : strength.score < 4
                                  ? "bg-amber-400"
                                  : "bg-violet-600"
                              : "bg-slate-200"
                          }`}
                          key={item}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold text-violet-700">
                      {strength.label}
                    </span>
                    <span className="hidden items-center gap-1 text-[9px] text-slate-500 sm:inline-flex">
                      {passwordForm.newPassword.length >= 8 ? (
                        <CheckCircle2 className="text-emerald-500" size={12} />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-slate-300" />
                      )}
                      8+ characters
                    </span>
                  </div>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] px-4 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      savingPassword ||
                      !passwordForm.currentPassword ||
                      passwordForm.newPassword.length < 8 ||
                      passwordForm.newPassword !== passwordForm.confirmPassword
                    }
                    type="submit"
                  >
                    {savingPassword ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </section>

            <section className={`${cardClass} p-4 sm:p-5`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-violet-600">
                    <BellRing size={15} />
                  </span>
                  <div>
                    <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                      Notification preferences
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      Choose what you want to see in this browser.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid min-w-0 gap-2 @min-[560px]/account:grid-cols-2 @min-[1000px]/account:grid-cols-3">
                {preferenceItems.map((item) => (
                  <label
                    className="flex min-w-0 cursor-pointer items-start justify-between gap-2 rounded-xl border border-slate-100 p-3 transition hover:border-violet-100 hover:bg-violet-50/30"
                    key={item.key}
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold text-slate-800">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[9px] leading-4 text-slate-500">
                        {item.description}
                      </span>
                    </span>
                    <input
                      checked={preferences[item.key]}
                      className="peer sr-only"
                      onChange={() => togglePreference(item.key)}
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${
                        preferences[item.key] ? "bg-violet-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                          preferences[item.key] ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[9px] text-slate-400">
                Preferences are stored on this device. Email notification
                delivery is not controlled by these settings.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
