import { useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
  Save,
  Upload,
  UserRound,
} from "lucide-react";
import dayjs from "dayjs";
import {
  changeMyPassword,
  updateMyProfile,
  updateMyNotificationPreferences,
  uploadMyProfileImage,
} from "../api/auth.api";
import useToastMessage from "../hooks/useToastMessage";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  profileImageAccept,
  validateProfileImage,
} from "../utils/profileImage";

const cardClass =
  "rounded-lg border border-[#E9E5F7] bg-white shadow-[0_8px_24px_rgba(106,13,173,0.06)]";
const defaultPreferences = {
  leaveUpdates: true,
  attendanceReminders: true,
  weeklySummary: false,
};

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
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#E9E5F7] bg-[#FBFAFF] px-3 py-3">
      <Icon className="shrink-0 text-violet-700" size={17} />
      <span className="min-w-0">
        <span className="block text-[12px] text-slate-600">{label}</span>
        <span className="mt-0.5 block truncate text-[14px] font-semibold text-slate-800">
          {value || "Not provided"}
        </span>
      </span>
      <LockKeyhole className="ml-auto shrink-0 text-slate-400" size={14} />
    </div>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block min-w-0 text-[13px] font-semibold text-slate-700">
      {label}
      <span className="mt-1.5 flex h-12 min-w-0 items-center gap-2.5 rounded-lg border border-[#E9E5F7] bg-[#FBFAFF] px-3 text-violet-700 transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15">
        <LockKeyhole className="shrink-0" size={16} />
        <input
          autoComplete={autoComplete}
          className="h-full w-full min-w-0 bg-transparent text-[16px] font-normal text-slate-800 outline-none placeholder:text-slate-400"
          onChange={onChange}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
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
  const [preferences, setPreferences] = useState(() => ({
    ...defaultPreferences,
    ...user?.notificationPreferences,
  }));
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const profileImagePreviewUrl = useRef("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  useEffect(() => () => {
    if (profileImagePreviewUrl.current) {
      URL.revokeObjectURL(profileImagePreviewUrl.current);
    }
  }, []);

  const updateSelectedProfileImage = (file) => {
    if (profileImagePreviewUrl.current) {
      URL.revokeObjectURL(profileImagePreviewUrl.current);
    }
    profileImagePreviewUrl.current = file ? URL.createObjectURL(file) : "";
    setProfileImage(file);
    setProfileImagePreview(profileImagePreviewUrl.current);
  };

  const strength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword],
  );
  const isProfileDirty = profileForm.name !== (user?.name || "");
  const avatarUrl = profileImagePreview || profileForm.profilePic;
  const hasProfileImage = Boolean(avatarUrl);
  const joinedDate = user?.joiningDate
    ? dayjs(user.joiningDate).format("DD MMM YYYY")
    : "Not provided";
  const shift = user?.shiftStart && user?.shiftEnd
    ? `${user.shiftStart} – ${user.shiftEnd}`
    : user?.shift || "Not provided";
  const statusLabel = user?.onboardingStatus
    ? `${user.onboardingStatus[0].toUpperCase()}${user.onboardingStatus.slice(1)}`
    : "Active";
  const statusTone = {
    approved: "bg-green-50 text-green-700",
    active: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-800",
    rejected: "bg-red-50 text-red-700",
    incomplete: "bg-slate-100 text-slate-700",
  }[statusLabel.toLowerCase()] || "bg-violet-100 text-violet-800";

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const name = profileForm.name.trim();
    if (name.length < 2) {
      setError("Your name must contain at least 2 characters.");
      return;
    }

    setSavingProfile(true);
    try {
      const result = await updateMyProfile({ name });
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

  const uploadProfilePhoto = async (image) => {
    if (!image) return;
    setError("");
    setNotice("");
    setSavingProfile(true);
    setUploadingProfileImage(true);
    try {
      const result = await uploadMyProfileImage(image);
      updateUser(result.user);
      setProfileForm((current) => ({
        ...current,
        profilePic: result.user.profilePic || "",
      }));
      updateSelectedProfileImage(null);
      setNotice(result.message || "Profile photo updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to upload your profile photo. Please try again.",
      );
    } finally {
      setSavingProfile(false);
      setUploadingProfileImage(false);
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
    if (passwordForm.newPassword.length < 12) {
      setError("Your new password must have at least 12 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      await changeMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      await onSignOut();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to change your password. Please try again.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const togglePreference = async (key) => {
    if (savingPreferences) return;
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setError("");
    setNotice("");
    setSavingPreferences(true);
    try {
      const result = await updateMyNotificationPreferences(next);
      const savedPreferences = result.user?.notificationPreferences || next;
      setPreferences({ ...defaultPreferences, ...savedPreferences });
      if (result.user) updateUser(result.user);
      setNotice(result.message || "Email notification preferences saved.");
    } catch (requestError) {
      setPreferences(previous);
      setError(
        requestError.response?.data?.message ||
          "Could not save your email preferences. Please try again.",
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  const togglePasswordVisibility = (key) =>
    setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }));

  const preferenceItems = [
    {
      key: "leaveUpdates",
      title: "Leave updates",
      description: "Email when a leave request is approved or rejected.",
    },
    {
      key: "attendanceReminders",
      title: "Attendance reminders",
      description: "On workdays, after shift grace period and at shift end.",
    },
    {
      key: "weeklySummary",
      title: "Weekly summary",
      description: "Activity digest every Monday at 9:00 AM.",
    },
  ];

  return (
    <main
      className="@container/account w-full min-w-0 max-w-full overflow-x-clip font-['Inter',sans-serif] text-slate-800"
      aria-labelledby="account-settings-title"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className="font-['Poppins',sans-serif] text-[28px] font-semibold leading-[1.2] tracking-[-0.6px] text-slate-900 xl:text-[30px]"
              id="account-settings-title"
            >
              Account settings
            </h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">
              Manage your profile, password, and notification preferences.
            </p>
          </div>
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#E9E5F7] bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            onClick={onSignOut}
            type="button"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </header>

        <div className="grid min-w-0 items-start gap-5 @min-[1000px]/account:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid min-w-0 grid-cols-1 gap-5">
            <section className={`${cardClass} overflow-hidden`}>
              <div className="bg-gradient-to-b from-violet-100 via-purple-50 to-white px-5 pb-5 pt-6 text-center">
                <label
                  aria-label="Choose or change profile photo"
                  className="group relative mx-auto grid h-[88px] w-[88px] cursor-pointer place-items-center rounded-full font-['Poppins',sans-serif] text-[26px] font-semibold text-white shadow-[0_8px_20px_rgba(106,13,173,0.22)] ring-4 ring-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-600"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br from-[#6A0DAD] to-[#7C3AED]">
                    <ProfileAvatar
                      alt={`${profileForm.name || "User"} profile`}
                      className="h-full w-full"
                      fallbackClassName="bg-gradient-to-br from-[#6A0DAD] to-[#7C3AED]"
                      name={profileForm.name}
                      src={avatarUrl}
                    />
                  </span>
                  <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-1 rounded-full bg-slate-950/60 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {uploadingProfileImage ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Upload size={13} />
                    )}
                    {uploadingProfileImage ? "Uploading..." : hasProfileImage ? "Change" : "Add photo"}
                  </span>
                  {!hasProfileImage && (
                    <span className="absolute -right-1 -top-1 z-20 grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-md">
                      {uploadingProfileImage ? (
                        <LoaderCircle className="animate-spin" size={13} />
                      ) : (
                        <Plus size={15} />
                      )}
                    </span>
                  )}
                  <input
                    accept={profileImageAccept}
                    aria-label="Select a profile photo"
                    className="sr-only"
                    disabled={savingProfile}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const validationMessage = validateProfileImage(file);
                      if (validationMessage) {
                        setError(validationMessage);
                        event.target.value = "";
                        return;
                      }
                      setError("");
                      updateSelectedProfileImage(file);
                      event.target.value = "";
                      void uploadProfilePhoto(file);
                    }}
                    type="file"
                  />
                </label>
                <h2 className="mt-4 truncate font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">
                  {user?.name || "Your profile"}
                </h2>
                <p className="mt-1 truncate text-[13px] text-slate-600">
                  {user?.email}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full bg-violet-100 px-3 py-1.5 text-[12px] font-semibold text-violet-800">
                    {user?.role === "admin" ? "Administrator" : "Employee"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold ${statusTone}`}>
                    <BadgeCheck size={14} />
                    {statusLabel}
                  </span>
                </div>
              </div>
              <div className="border-t border-[#E9E5F7] px-5 py-4">
                <p className="text-[12px] leading-5 text-slate-600">
                  Upload a JPEG, PNG, or WebP photo up to 5 MB.
                </p>
              </div>
            </section>

            <section className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[17px] font-semibold text-slate-900">
                  Work details
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1.5 text-[12px] font-semibold text-violet-800">
                  <LockKeyhole size={13} />
                  Read only
                </span>
              </div>
              <div className="mt-4 grid gap-2">
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
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-3 text-[12px] leading-5 text-violet-800">
                <Info className="mt-0.5 shrink-0" size={15} />
                Managed by your administrator. Contact HR if something is
                incorrect.
              </div>
            </section>

          </aside>

          <div className="grid min-w-0 gap-4">
            <section className={`${cardClass} p-5 sm:p-6`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-['Poppins',sans-serif] text-[17px] font-semibold text-slate-900">
                    Personal information
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-600">
                    Update the details you&apos;re allowed to change.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[12px] font-medium text-slate-600">
                  <LockKeyhole size={13} />
                  Work email is read-only
                </span>
              </div>
              <form onSubmit={saveProfile}>
                <div className="grid min-w-0 gap-3 @min-[520px]/account:grid-cols-2">
                  <label className="block min-w-0 text-[13px] font-semibold text-slate-700">
                    Full name
                    <span className="mt-1.5 flex h-12 min-w-0 items-center gap-2.5 rounded-lg border border-[#E9E5F7] bg-[#FBFAFF] px-3 text-violet-700 transition focus-within:border-violet-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/15">
                      <UserRound className="shrink-0" size={16} />
                      <input
                        autoComplete="name"
                        className="h-full w-full min-w-0 bg-transparent text-[16px] font-normal text-slate-800 outline-none"
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
                  <label className="block min-w-0 text-[13px] font-semibold text-slate-700">
                    Work email
                    <span className="mt-1.5 flex h-12 min-w-0 items-center gap-2.5 rounded-lg border border-[#E9E5F7] bg-slate-50 px-3 text-slate-500">
                      <Mail className="shrink-0 text-violet-600" size={16} />
                      <input
                        className="h-full w-full min-w-0 bg-transparent text-[16px] font-normal text-slate-700 outline-none"
                        readOnly
                        value={user?.email || ""}
                      />
                    </span>
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#E9E5F7] px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={(!isProfileDirty && !profileImage) || savingProfile}
                    onClick={() => {
                      setProfileForm({
                        name: user?.name || "",
                        profilePic: user?.profilePic || "",
                      });
                      updateSelectedProfileImage(null);
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                  <button
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.22)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
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

            <section className={`${cardClass} p-5 sm:p-6`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-['Poppins',sans-serif] text-[17px] font-semibold text-slate-900">
                    Change password
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-600">
                    Choose a strong password you don&apos;t use elsewhere.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1.5 text-[12px] font-medium text-violet-800">
                  <KeyRound size={14} />
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
                <div className="mt-4 flex min-w-0 flex-col gap-3 @min-[520px]/account:flex-row @min-[520px]/account:flex-wrap @min-[520px]/account:items-center @min-[520px]/account:justify-between">
                  <div
                    aria-label={`Password strength: ${strength.label}`}
                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 @min-[520px]/account:flex-1"
                  >
                    <div aria-hidden="true" className="flex shrink-0 gap-1">
                      {[0, 1, 2, 3].map((item) => (
                        <span
                          className={`h-1.5 w-8 rounded-full ${
                            item < strength.score
                              ? strength.score < 2
                                ? "bg-red-500"
                                : strength.score < 4
                                  ? "bg-amber-400"
                                  : "bg-violet-600"
                              : "bg-slate-200"
                          }`}
                          key={item}
                        />
                      ))}
                    </div>
                    <span className="min-w-0 basis-full text-[13px] font-semibold leading-4 text-violet-800 @min-[520px]/account:basis-auto @min-[520px]/account:whitespace-nowrap">
                      {strength.label}
                    </span>
                    <span className="hidden items-center gap-1 text-[12px] text-slate-600 sm:inline-flex">
                      {passwordForm.newPassword.length >= 8 ? (
                        <CheckCircle2 className="text-green-600" size={14} />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-slate-400" />
                      )}
                      8+ characters
                    </span>
                  </div>
                  <button
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.22)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50 @min-[520px]/account:w-auto"
                    disabled={
                      savingPassword ||
                      !passwordForm.currentPassword ||
                      passwordForm.newPassword.length < 12 ||
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
                <p className="mt-3 text-[12px] leading-5 text-slate-600">
                  Use 8+ characters with uppercase and lowercase letters, a
                  number, and a symbol for the strongest password.
                </p>
              </form>
            </section>

            <section className={`${cardClass} p-5 sm:p-6`}>
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-100 text-violet-800">
                    <BellRing size={17} />
                  </span>
                  <div>
                    <h2 className="font-['Poppins',sans-serif] text-[17px] font-semibold text-slate-900">
                      Notification preferences
                    </h2>
                    <p className="mt-0.5 text-[13px] text-slate-600">
                      Choose which email notifications you receive.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid min-w-0 gap-2 @min-[560px]/account:grid-cols-2 @min-[1000px]/account:grid-cols-3">
                {preferenceItems.map((item) => (
                  <label
                    className={`flex min-h-[88px] min-w-0 items-start justify-between gap-3 rounded-lg border border-[#E9E5F7] p-4 transition hover:border-violet-300 hover:bg-violet-50/40 ${
                      savingPreferences ? "cursor-wait opacity-70" : "cursor-pointer"
                    }`}
                    key={item.key}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-800">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-5 text-slate-600">
                        {item.description}
                      </span>
                    </span>
                    <input
                      aria-label={item.title}
                      checked={preferences[item.key]}
                      className="peer sr-only"
                      disabled={savingPreferences}
                      onChange={() => togglePreference(item.key)}
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-violet-500/20 ${
                        preferences[item.key] ? "bg-violet-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          preferences[item.key] ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </label>
                ))}
              </div>
              
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
