import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Crosshair,
  Info,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { getOfficeSettings, listEmployees, updateOfficeSettings } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";
import useToastMessage from "../../hooks/useToastMessage";

const defaultOffice = {
  name: "Main Office",
  latitude: "",
  longitude: "",
  radiusMeters: 100,
  graceMinutes: 15,
  amShiftStart: "09:00",
  amShiftEnd: "18:00",
  pmShiftStart: "11:00",
  pmShiftEnd: "20:00",
  weekendDays: [0, 6],
};

const weekDays = [
  [0, "Sunday", "Sun"],
  [1, "Monday", "Mon"],
  [2, "Tuesday", "Tue"],
  [3, "Wednesday", "Wed"],
  [4, "Thursday", "Thu"],
  [5, "Friday", "Fri"],
  [6, "Saturday", "Sat"],
];

const toForm = (settings = {}) => ({
  name: settings.name || defaultOffice.name,
  latitude: settings.latitude == null ? "" : String(settings.latitude),
  longitude: settings.longitude == null ? "" : String(settings.longitude),
  radiusMeters: settings.radiusMeters ?? defaultOffice.radiusMeters,
  graceMinutes: settings.graceMinutes ?? defaultOffice.graceMinutes,
  amShiftStart: settings.amShiftStart || defaultOffice.amShiftStart,
  amShiftEnd: settings.amShiftEnd || defaultOffice.amShiftEnd,
  pmShiftStart: settings.pmShiftStart || defaultOffice.pmShiftStart,
  pmShiftEnd: settings.pmShiftEnd || defaultOffice.pmShiftEnd,
  weekendDays: [...(settings.weekendDays || defaultOffice.weekendDays)].sort((a, b) => a - b),
});

const coordinateValue = (value) => value === "" ? null : Number(value);
const hasCoordinates = (office) => office.latitude !== "" && office.longitude !== "";
const sameCoordinates = (first, second) =>
  coordinateValue(first.latitude) === coordinateValue(second.latitude)
  && coordinateValue(first.longitude) === coordinateValue(second.longitude);
const sameArray = (first, second) =>
  first.length === second.length && first.every((value, index) => value === second[index]);

const initials = (name = "") =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "AD";

const coordinateLabel = (office) => hasCoordinates(office)
  ? `${Number(office.latitude).toFixed(6).replace(/\.?0+$/, "")}, ${Number(office.longitude).toFixed(6).replace(/\.?0+$/, "")}`
  : "Not configured";

const formatDistance = (meters) => meters >= 1000
  ? `${(meters / 1000).toFixed(2).replace(/\.?0+$/, "")} km`
  : `${Math.round(meters)} m`;

const distanceBetween = (first, second) => {
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(Number(second.latitude) - Number(first.latitude));
  const longitudeDelta = radians(Number(second.longitude) - Number(first.longitude));
  const originLatitude = radians(Number(first.latitude));
  const targetLatitude = radians(Number(second.latitude));
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedValue = Math.min(1, value);
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedValue), Math.sqrt(1 - boundedValue));
};

const validationMessage = (office) => {
  if (!office.name.trim()) return "Enter an office name.";
  if (office.name.trim().length > 150) return "The office name must be 150 characters or fewer.";
  if ((office.latitude === "") !== (office.longitude === "")) return "Latitude and longitude must both be set or both be empty.";
  if (hasCoordinates(office)) {
    const latitude = Number(office.latitude);
    const longitude = Number(office.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude must be between −90 and 90.";
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude must be between −180 and 180.";
  }
  if (!Number.isInteger(office.radiusMeters) || office.radiusMeters < 20 || office.radiusMeters > 1000) {
    return "Geofence radius must be between 20 and 1,000 meters.";
  }
  if (!Number.isInteger(office.graceMinutes) || office.graceMinutes < 0 || office.graceMinutes > 120) {
    return "Grace period must be between 0 and 120 minutes.";
  }
  for (const [label, start, end] of [
    ["AM", office.amShiftStart, office.amShiftEnd],
    ["PM", office.pmShiftStart, office.pmShiftEnd],
  ]) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
      return `Enter valid 24-hour start and end times for the ${label} shift.`;
    }
    if (start >= end) return `The ${label} shift end time must be later than its start time.`;
  }
  if (new Set(office.weekendDays).size !== office.weekendDays.length) return "Weekend days must be unique.";
  return "";
};

async function getApprovedEmployees() {
  const limit = 100;
  const firstPage = await listEmployees({ status: "approved", account: "active", page: 1, limit });
  const pages = firstPage.pagination?.pages || 1;
  if (pages <= 1) return firstPage.users || [];
  const remaining = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listEmployees({ status: "approved", account: "active", page: index + 2, limit })),
  );
  return [
    ...(firstPage.users || []),
    ...remaining.flatMap((result) => result.users || []),
  ];
}

function getShiftGroups(employees, schedules) {
  const groups = new Map();
  for (const employee of employees) {
    const shift = employee.shift || "AM";
    const defaultSchedule = shift === "PM"
      ? [schedules.pmShiftStart, schedules.pmShiftEnd]
      : [schedules.amShiftStart, schedules.amShiftEnd];
    const start = employee.shiftStart || defaultSchedule[0];
    const end = employee.shiftEnd || defaultSchedule[1];
    const key = `${shift}-${start}-${end}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: shift === "PM" ? "PM shift" : shift === "AM" ? "AM shift" : "Custom shift",
        start,
        end,
        employees: 0,
      });
    }
    groups.get(key).employees += 1;
  }
  return [...groups.values()].sort((first, second) =>
    first.start.localeCompare(second.start) || first.end.localeCompare(second.end));
}

function lastSavedLabel(updatedAt, updatedBy) {
  if (!updatedAt) return "No saved configuration yet";
  const date = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(new Date(updatedAt));
  return `Last saved ${date}${updatedBy ? ` by ${updatedBy}` : ""}`;
}

export default function AdminOfficeSettingsPage({ embedded = false, onNavigate }) {
  const { user } = useAuth();
  const [office, setOffice] = useState(defaultOffice);
  const [savedOffice, setSavedOffice] = useState(defaultOffice);
  const [savedMeta, setSavedMeta] = useState({ isConfigured: false, updatedAt: null, updatedBy: null, revision: 0 });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [officeLoaded, setOfficeLoaded] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [error, setError] = useState("");
  const [shiftError, setShiftError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(shiftError, "error");
  useToastMessage(notice, "success");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setOfficeLoaded(false);
    setShiftLoading(true);
    setError("");
    setShiftError("");
    setSaveConflict(false);
    const [officeResult, employeesResult] = await Promise.allSettled([
      getOfficeSettings(),
      getApprovedEmployees(),
    ]);
    if (request !== requestId.current) return;

    if (officeResult.status === "fulfilled" && officeResult.value.settings) {
      const current = toForm(officeResult.value.settings);
      setOffice(current);
      setSavedOffice(current);
      setSavedMeta({
        isConfigured: Boolean(officeResult.value.settings.isConfigured),
        updatedAt: officeResult.value.settings.updatedAt || null,
        updatedBy: officeResult.value.settings.updatedBy || null,
        revision: officeResult.value.settings.revision ?? 0,
      });
      setOfficeLoaded(true);
    } else {
      setError(
        officeResult.status === "rejected"
          ? officeResult.reason?.response?.data?.message || "Unable to load office settings."
          : "The office settings response was incomplete. Please reload and try again.",
      );
    }

    if (employeesResult.status === "fulfilled") {
      setEmployees(employeesResult.value);
    } else {
      setShiftError(employeesResult.reason?.response?.data?.message || "Unable to load employee shift assignments.");
    }
    setLoading(false);
    setShiftLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!confirmationOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) setConfirmationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmationOpen, saving]);

  const changedFields = useMemo(() => {
    const changes = [];
    if (office.name.trim() !== savedOffice.name.trim()) changes.push("office name");
    if (!sameCoordinates(office, savedOffice)) changes.push("location");
    if (office.radiusMeters !== savedOffice.radiusMeters) changes.push("geofence radius");
    if (office.graceMinutes !== savedOffice.graceMinutes) changes.push("grace period");
    if (office.amShiftStart !== savedOffice.amShiftStart || office.amShiftEnd !== savedOffice.amShiftEnd) changes.push("AM shift times");
    if (office.pmShiftStart !== savedOffice.pmShiftStart || office.pmShiftEnd !== savedOffice.pmShiftEnd) changes.push("PM shift times");
    if (!sameArray(office.weekendDays, savedOffice.weekendDays)) changes.push("weekend days");
    return changes;
  }, [office, savedOffice]);
  const hasChanges = changedFields.length > 0;
  const groups = useMemo(() => getShiftGroups(employees, savedOffice), [employees, savedOffice]);
  const validation = validationMessage(office);
  const oldAndNewLocation = hasCoordinates(savedOffice) && hasCoordinates(office)
    ? distanceBetween(savedOffice, office)
    : null;

  const updateField = (key, value) => {
    setOffice((current) => ({ ...current, [key]: value }));
    if (!saveConflict) setError("");
    setNotice("");
  };

  const toggleWeekend = (day) => {
    setOffice((current) => ({
      ...current,
      weekendDays: current.weekendDays.includes(day)
        ? current.weekendDays.filter((item) => item !== day)
        : [...current.weekendDays, day].sort((a, b) => a - b),
    }));
    if (!saveConflict) setError("");
    setNotice("");
  };

  const useCurrentLocation = () => {
    if (!saveConflict) setError("");
    setNotice("");
    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOffice((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      (locationError) => {
        const message = locationError.code === 1
          ? "Location access was denied. Allow it in your browser settings and try again."
          : locationError.code === 3
            ? "Location lookup timed out. Please try again."
            : "Unable to determine your current location.";
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const requestSave = () => {
    if (saveConflict) {
      setConfirmationOpen(true);
      return;
    }
    setError("");
    setNotice("");
    if (validation) {
      setError(validation);
      return;
    }
    if (!hasChanges) return;
    setConfirmationOpen(true);
  };

  const save = async () => {
    const validationError = validationMessage(office);
    if (validationError) {
      setError(validationError);
      setConfirmationOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await updateOfficeSettings({
        name: office.name.trim(),
        latitude: coordinateValue(office.latitude),
        longitude: coordinateValue(office.longitude),
        radiusMeters: office.radiusMeters,
        graceMinutes: office.graceMinutes,
        amShiftStart: office.amShiftStart,
        amShiftEnd: office.amShiftEnd,
        pmShiftStart: office.pmShiftStart,
        pmShiftEnd: office.pmShiftEnd,
        weekendDays: office.weekendDays,
        revision: savedMeta.revision,
      });
      if (!result.settings) {
        setError("The server did not confirm the saved settings. Reload before making further changes.");
        return;
      }
      const current = toForm(result.settings);
      setOffice(current);
      setSavedOffice(current);
      setSavedMeta({
        isConfigured: Boolean(result.settings.isConfigured),
        updatedAt: result.settings.updatedAt || null,
        updatedBy: result.settings.updatedBy || user?.name || null,
        revision: result.settings.revision ?? 0,
      });
      setSaveConflict(false);
      setConfirmationOpen(false);
      setNotice(result.message || "Office settings saved.");
    } catch (requestError) {
      const conflict = requestError.response?.status === 409;
      setSaveConflict(conflict);
      setError(conflict
        ? requestError.response?.data?.message || "Another administrator updated these settings. Reload the latest version before saving."
        : requestError.response?.data?.message || "Unable to save office settings. Your changes are still available to retry.");
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (saveConflict) {
      setConfirmationOpen(false);
      void load();
      return;
    }
    setOffice(savedOffice);
    setError("");
    setNotice("");
    setConfirmationOpen(false);
  };

  const mapRadius = Math.max(70, Math.min(180, office.radiusMeters / 1000 * 180));
  const contentClass = embedded
    ? "w-full min-w-0 max-w-full overflow-x-clip bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-0 py-5 font-['Inter',sans-serif] text-slate-800 sm:py-6 lg:py-5"
    : "min-h-screen bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-4 py-5 font-['Inter',sans-serif] text-slate-800 sm:px-8 sm:py-7";

  return (
    <main className={contentClass}>
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="font-['Poppins',sans-serif] text-[30px] font-semibold leading-[1.25] tracking-[-.6px] text-slate-900">Office settings</h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">Organization-wide rules for attendance, leave and automation.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${!officeLoaded ? "border-slate-200 bg-slate-100 text-slate-600" : savedMeta.isConfigured ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <span className={`size-2 rounded-full ${!officeLoaded ? "bg-slate-500" : savedMeta.isConfigured ? "bg-green-700" : "bg-amber-700"}`} />
              {loading ? "Loading" : !officeLoaded ? "Unavailable" : savedMeta.isConfigured ? "Configured" : "Location not configured"}
            </div>
            <button type="button" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"><Bell size={17} /><span className="absolute right-2 top-2 size-2 rounded-full bg-red-700" /></button>
            <div className="flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 shadow-sm">
              <span className="grid size-8 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800">{initials(user?.name)}</span>
              <span className="max-w-20 truncate text-[13px] font-medium text-slate-700">{user?.name?.split(" ")[0] || "Admin"}</span>
            </div>
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-2 text-[13px] text-violet-800 sm:items-center">
            <Info className="mt-0.5 shrink-0 text-violet-800 sm:mt-0" size={17} />
            <span><strong>One configuration for the whole organization.</strong> Rules are used by:</span>
          </div>
          <div className="flex flex-wrap gap-2 pl-5 sm:pl-0">
            <UsageChip icon={Clock3}>Attendance</UsageChip>
            <UsageChip icon={CalendarDays}>Leave days</UsageChip>
            <UsageChip icon={SlidersHorizontal}>Nightly automation</UsageChip>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] xl:gap-5">
          <div className="grid min-w-0 content-start gap-4 xl:gap-5">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">Office location</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800"><LockKeyhole size={14} />Administrators only</span>
              </div>
              {loading ? <SettingsSkeleton /> : !officeLoaded ? (
                <LoadFailure onRetry={load} />
              ) : (
                <>
                  <label className="block text-[14px] font-semibold text-slate-700">Office name
                    <input className="mt-1.5 h-11 w-full rounded-xl border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] font-normal text-slate-800 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" maxLength={150} value={office.name} onChange={(event) => updateField("name", event.target.value)} />
                  </label>

                  <div className="relative mt-3 h-[118px] overflow-hidden rounded-xl border border-slate-200 bg-violet-50 sm:h-[132px]" aria-label="Illustrative geofence preview">
                    <div className="absolute inset-0 opacity-80" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 25px, #fff 25px 33px, transparent 33px 56px), repeating-linear-gradient(90deg, transparent 0 48px, #fff 48px 57px, transparent 57px 93px)" }} />
                    <div className="absolute left-[8%] top-[35%] h-10 w-[30%] rounded-lg bg-violet-100/80" />
                    <div className="absolute right-[9%] top-[10%] h-8 w-[23%] rounded-lg bg-slate-100/80" />
                    <div className="absolute -left-[5%] top-[52%] h-[3px] w-[115%] rotate-[-12deg] bg-white shadow-[0_1px_3px_rgba(15,23,42,.08)]" />
                    {hasCoordinates(office) ? <>
                      <div className="absolute left-1/2 top-1/2 rounded-full border-2 border-violet-600/80 bg-violet-400/15" style={{ height: mapRadius, width: mapRadius, transform: "translate(-50%, -50%)" }} />
                      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-violet-800">
                        <MapPin size={22} fill="currentColor" stroke="white" strokeWidth={1.5} />
                      </div>
                      <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700">{office.radiusMeters} m radius · illustrative only</span>
                    </> : <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">Set coordinates to configure the office pin</span>}
                    <span className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700">No external map service</span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block min-w-0 text-[14px] font-semibold text-slate-700">Latitude
                      <input className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-400 bg-[#FBFAFF] px-2.5 text-[16px] font-normal text-slate-800 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:px-3 sm:text-[14px]" type="number" step="any" min="-90" max="90" value={office.latitude} onChange={(event) => updateField("latitude", event.target.value)} placeholder="e.g. 31.5204" />
                    </label>
                    <label className="block min-w-0 text-[14px] font-semibold text-slate-700">Longitude
                      <input className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-400 bg-[#FBFAFF] px-2.5 text-[16px] font-normal text-slate-800 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:px-3 sm:text-[14px]" type="number" step="any" min="-180" max="180" value={office.longitude} onChange={(event) => updateField("longitude", event.target.value)} placeholder="e.g. 74.3587" />
                    </label>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600"><Crosshair size={14} className="shrink-0 text-violet-800" />Latitude and longitude are validated and saved together.</p>
                  <button type="button" onClick={useCurrentLocation} disabled={locating} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white text-[13px] font-semibold text-violet-800 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-wait disabled:opacity-60">
                    {locating ? <LoaderCircle className="animate-spin" size={16} /> : <MapPin size={16} />}
                    {locating ? "Finding current location…" : "Use my current location"}
                  </button>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
              <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">Who sees what</h2>
              <div className="mt-3 grid gap-2 min-[520px]:grid-cols-2">
                <VisibilityCard
                  icon={ShieldCheck}
                  title="Administrators"
                  description="Exact coordinates, geofence radius, grace period and weekend rules."
                />
                <VisibilityCard
                  icon={Users}
                  title="Employees"
                  description="Office name and general rules only. Exact coordinates are never returned."
                />
              </div>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-[1.5] text-slate-600"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-violet-800" />Location access is requested only when you choose “Use my current location.” Nothing is sent to a map provider.</p>
            </section>
          </div>

          <div className="grid min-w-0 content-start gap-4 xl:gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">Attendance rules</h2>
                <span className="text-xs text-slate-600">Used when employees check in and out</span>
              </div>
              {loading ? <SettingsSkeleton /> : !officeLoaded ? (
                <LoadFailure onRetry={load} />
              ) : (
                <>
                  <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-slate-700" htmlFor="office-radius">
                    Geofence radius
                    <span className="rounded-lg border border-slate-300 bg-[#FBFAFF] px-3 py-1.5 font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-800">{office.radiusMeters} m</span>
                  </label>
                  <input id="office-radius" className="mt-2 h-2 w-full cursor-pointer accent-violet-600" type="range" min="20" max="1000" step="10" value={office.radiusMeters} onChange={(event) => updateField("radiusMeters", Number(event.target.value))} />
                  <div className="mt-1 flex justify-between text-xs text-slate-600"><span>20 m</span><span>1,000 m</span></div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-[1.5] text-slate-600"><MapPin size={14} className="mt-0.5 shrink-0" />Employees must be within this distance of the saved office location to check in.</p>

                  <label className="mt-3 flex items-center justify-between gap-3 text-[14px] font-semibold text-slate-700" htmlFor="office-grace">
                    Grace period
                    <span className="rounded-lg border border-slate-300 bg-[#FBFAFF] px-3 py-1.5 font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-800">{office.graceMinutes} min</span>
                  </label>
                  <input id="office-grace" className="mt-2 h-2 w-full cursor-pointer accent-violet-600" type="range" min="0" max="120" step="5" value={office.graceMinutes} onChange={(event) => updateField("graceMinutes", Number(event.target.value))} />
                  <div className="mt-1 flex justify-between text-xs text-slate-600"><span>0 min</span><span>120 min</span></div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-[1.5] text-slate-600"><Clock3 size={14} className="mt-0.5 shrink-0" />Late status starts after each employee&apos;s shift start plus this grace period.</p>

                  <fieldset className="mt-3">
                    <legend className="text-[14px] font-semibold text-slate-700">Weekend days</legend>
                    <p className="mb-1.5 mt-1 text-right text-xs text-slate-600">{office.weekendDays.length} selected</p>
                    <div className="grid grid-cols-4 gap-1.5 min-[440px]:grid-cols-7">
                      {weekDays.map(([day, name, shortName]) => {
                        const selectedDay = office.weekendDays.includes(day);
                        return (
                          <button key={day} type="button" onClick={() => toggleWeekend(day)} aria-pressed={selectedDay} aria-label={`${name}${selectedDay ? ", weekend" : ", working day"}`} className={`h-10 rounded-lg border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 ${selectedDay ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50"}`}>{shortName}</button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-[1.5] text-slate-600"><Clock3 size={14} className="mt-0.5 shrink-0" />Selected days are excluded from working-day and leave-day calculations.</p>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">AM and PM shift hours</h2>
                {onNavigate && <button type="button" onClick={() => onNavigate("Employees")} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950"><Users size={15} />Manage per employee</button>}
              </div>
              <p className="mt-1 text-[13px] leading-[1.5] text-slate-600">These hours are assigned when an employee is approved. Employees choose AM or PM during onboarding; existing employee schedules are not changed.</p>
              {loading ? <div className="mt-3"><SettingsSkeleton /></div> : !officeLoaded ? (
                <LoadFailure onRetry={load} />
              ) : (
                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                  <ShiftScheduleFields
                    label="AM shift"
                    startName="amShiftStart"
                    endName="amShiftEnd"
                    start={office.amShiftStart}
                    end={office.amShiftEnd}
                    onChange={updateField}
                  />
                  <ShiftScheduleFields
                    label="PM shift"
                    startName="pmShiftStart"
                    endName="pmShiftEnd"
                    start={office.pmShiftStart}
                    end={office.pmShiftEnd}
                    onChange={updateField}
                  />
                </div>
              )}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[13px] font-semibold text-slate-700">Current employee assignments</p>
              {shiftLoading ? (
                <div className="grid min-h-20 place-items-center"><LoaderCircle className="animate-spin text-violet-600" size={17} /></div>
              ) : groups.length ? (
                <div className="mt-2 divide-y divide-slate-100">
                  {groups.map((group) => (
                    <div className="flex items-center gap-2.5 py-2.5" key={group.key}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-800"><Clock3 size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-[13px] font-semibold text-slate-800">{group.label}</strong>
                        <span className="mt-0.5 block text-xs text-slate-600">{group.start}–{group.end}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">{group.employees} employee{group.employees === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-[13px] text-slate-600">No active approved employee shifts to show.</p>
              )}
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-2 z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_8px_24px_rgba(15,23,42,.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={`flex items-center gap-1.5 text-xs font-medium ${hasChanges ? "text-amber-800" : "text-slate-600"}`}>
              <span className={`size-2 shrink-0 rounded-full ${hasChanges ? "bg-amber-700" : "bg-green-700"}`} />
              {hasChanges ? `${changedFields.length} unsaved change${changedFields.length === 1 ? "" : "s"}` : "No unsaved changes"}
              {!hasChanges && !loading && <span className="hidden text-slate-500 min-[520px]:inline">· {lastSavedLabel(savedMeta.updatedAt, savedMeta.updatedBy || undefined)}</span>}
            </p>
            {hasChanges && <p className="mt-0.5 truncate text-xs text-slate-600">{changedFields.map((field) => field[0].toUpperCase() + field.slice(1)).join(", ")}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" onClick={discardChanges} disabled={(!hasChanges && !saveConflict) || saving} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{saveConflict ? "Discard & reload" : "Discard"}</button>
            <button type="button" onClick={requestSave} disabled={!hasChanges || loading || !officeLoaded || saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(106,13,173,.2)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-45">
              <Save size={16} />Save settings
            </button>
          </div>
        </div>
      </div>

      {confirmationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmationOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="office-confirm-title" className="my-auto w-full max-w-[500px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-800"><SlidersHorizontal size={18} /></span>
                <div>
                  <h2 id="office-confirm-title" className="font-['Poppins',sans-serif] text-xl font-semibold text-slate-900">Save office settings?</h2>
                  <p className="mt-1 text-[13px] leading-[1.5] text-slate-600">Review these organization-wide changes before applying them.</p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmationOpen(false)} disabled={saving} aria-label="Close confirmation" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"><X size={18} /></button>
            </header>

            <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 px-3.5">
              {changedFields.includes("office name") && <ChangeRow label="Office name" before={savedOffice.name} after={office.name.trim()} />}
              {changedFields.includes("location") && (
                <div className="py-2.5">
                  <p className="text-xs text-slate-600">Location</p>
                  <p className="mt-1 break-words text-[13px] font-semibold text-slate-800">{coordinateLabel(savedOffice)} <span className="mx-1 text-violet-800">→</span> {coordinateLabel(office)}</p>
                  {oldAndNewLocation !== null && <p className="mt-1 text-xs text-slate-600">Office center moves approximately {formatDistance(oldAndNewLocation)}. Coordinates stay private to administrators.</p>}
                </div>
              )}
              {changedFields.includes("geofence radius") && <ChangeRow label="Geofence radius" before={`${savedOffice.radiusMeters} m`} after={`${office.radiusMeters} m`} />}
              {changedFields.includes("grace period") && (
                <div className="py-2.5">
                  <ChangeRow label="Grace period" before={`${savedOffice.graceMinutes} min`} after={`${office.graceMinutes} min`} />
                  <p className="mt-1 text-xs text-slate-600">Late threshold is each employee&apos;s shift start plus the configured grace period.</p>
                </div>
              )}
              {changedFields.includes("AM shift times") && <ChangeRow label="AM shift hours" before={`${savedOffice.amShiftStart}–${savedOffice.amShiftEnd}`} after={`${office.amShiftStart}–${office.amShiftEnd}`} />}
              {changedFields.includes("PM shift times") && <ChangeRow label="PM shift hours" before={`${savedOffice.pmShiftStart}–${savedOffice.pmShiftEnd}`} after={`${office.pmShiftStart}–${office.pmShiftEnd}`} />}
              {changedFields.includes("weekend days") && <ChangeRow label="Weekend days" before={weekendLabel(savedOffice.weekendDays)} after={weekendLabel(office.weekendDays)} />}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] leading-[1.5] text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={16} />
              <span>
                {changedFields.includes("location") && !hasCoordinates(office)
                  ? "Removing coordinates disables location-based office verification. "
                  : changedFields.includes("location") && savedMeta.isConfigured && hasCoordinates(office)
                    ? `Employees at the old location may fall outside the new ${office.radiusMeters} m check-in radius. `
                    : changedFields.includes("location") && hasCoordinates(office)
                      ? "Location verification will apply to future check-ins. "
                  : ""}
                {changedFields.includes("geofence radius") && office.radiusMeters < savedOffice.radiusMeters
                  ? "A smaller radius may prevent check-ins near the office boundary. "
                  : ""}
                {changedFields.some((field) => field.endsWith("shift times"))
                  ? "New approvals use the selected AM or PM hours. Existing employee schedules are not changed. "
                  : ""}
                Saved clock-in and clock-out timestamps are not edited. Attendance and leave results are evaluated using the updated rules.
              </span>
            </div>
            {saveConflict && <button type="button" onClick={() => { setConfirmationOpen(false); void load(); }} className="mt-2 rounded-lg px-2 py-1 text-[12px] font-semibold text-violet-800 hover:bg-violet-50 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">Discard this draft and reload the latest settings</button>}

            <footer className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmationOpen(false)} disabled={saving} className="h-10 rounded-xl border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={save} disabled={saving || Boolean(validation) || saveConflict} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(106,13,173,.2)] transition hover:brightness-105 disabled:opacity-60">
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
                {saving ? "Saving…" : "Confirm and save"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function ShiftScheduleFields({ label, startName, endName, start, end, onChange }) {
  const inputClass = "mt-1 h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-[#FBFAFF] px-2 text-[16px] font-medium text-slate-800 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]";
  return <fieldset className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <legend className="px-1 text-[13px] font-semibold text-slate-700">{label}</legend>
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <label className="min-w-0 text-xs font-medium text-slate-600">Starts
        <input aria-label={`${label} start time`} className={inputClass} type="time" value={start} onChange={(event) => onChange(startName, event.target.value)} />
      </label>
      <label className="min-w-0 text-xs font-medium text-slate-600">Ends
        <input aria-label={`${label} end time`} className={inputClass} type="time" value={end} onChange={(event) => onChange(endName, event.target.value)} />
      </label>
    </div>
  </fieldset>;
}

function UsageChip({ icon: Icon, children }) {
  return <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-800"><Icon size={14} />{children}</span>;
}

function VisibilityCard({ icon: Icon, title, description }) {
  return <div className="rounded-xl border border-slate-200 p-3">
    <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><Icon size={15} className="text-violet-800" />{title}</h3>
    <p className="mt-1.5 text-xs leading-[1.5] text-slate-600">{description}</p>
  </div>;
}

function ChangeRow({ label, before, after }) {
  return <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="shrink-0 text-xs text-slate-600">{label}</span>
    <span className="min-w-0 break-words text-right text-[13px] font-semibold text-slate-800"><span className="text-slate-500 line-through">{before}</span><span className="mx-1.5 text-violet-800">→</span>{after}</span>
  </div>;
}

function SettingsSkeleton() {
  return <div className="space-y-2.5" aria-label="Loading office settings">
    <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
    <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
    <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
  </div>;
}

function LoadFailure({ onRetry }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-4 text-center">
    <p className="text-[13px] text-red-700">Current organization settings were not loaded. Editing is disabled to prevent overwriting existing rules.</p>
    <button type="button" onClick={onRetry} className="mt-2 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950">Retry loading</button>
  </div>;
}

function weekendLabel(days) {
  return days.length ? days.map((day) => weekDays.find(([value]) => value === day)?.[2]).join(", ") : "No days selected";
}
