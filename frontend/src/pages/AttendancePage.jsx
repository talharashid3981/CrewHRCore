import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, LocateFixed, LogOut, MapPin, RefreshCw } from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { checkInAttendance, checkOutAttendance, getAttendanceHistory, getAttendanceToday } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);
const zone = "Asia/Karachi";
const dateInput = (date) => dayjs(date).tz(zone).format("YYYY-MM-DD");
const timeValue = (value) => value ? dayjs(value).tz(zone).format("hh:mm A") : "—";
const minutesValue = (value) => value === undefined || value === null ? "—" : `${Math.floor(value / 60)}h ${value % 60}m`;

export default function AttendancePage() {
  const { user, logout } = useAuth();
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [from, setFrom] = useState(dayjs().tz(zone).startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadToday = async () => {
    const data = await getAttendanceToday();
    setToday(data);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try { const data = await getAttendanceHistory({ from, to }); setHistory(data.attendance || []); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to load attendance history."); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    let active = true;
    Promise.all([getAttendanceToday(), getAttendanceHistory({ from, to })])
      .then(([todayData, historyData]) => { if (active) { setToday(todayData); setHistory(historyData.attendance || []); } })
      .catch((requestError) => active && setError(requestError.response?.data?.message || "Unable to load attendance."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [from, to]);

  const readBestLocation = () => new Promise((resolve, reject) => {
    const attempts = 3;
    const timeout = 20000;
    let bestPosition = null;
    let lastError = null;

    const read = (attempt) => {
      navigator.geolocation.getCurrentPosition((position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) bestPosition = position;
        if (bestPosition.coords.accuracy <= 100 || attempt >= attempts) return resolve(bestPosition);
        window.setTimeout(() => read(attempt + 1), 1200);
      }, (geoError) => {
        lastError = geoError;
        if (geoError.code === geoError.PERMISSION_DENIED || attempt >= attempts) return reject(lastError);
        window.setTimeout(() => read(attempt + 1), 1200);
      }, { enableHighAccuracy: true, timeout, maximumAge: 0 });
    };

    read(1);
  });

  const locateAndSubmit = async (action) => {
    if (!navigator.geolocation) { setError("Your browser does not support GPS location."); return; }
    setWorking(true); setError(""); setNotice("");
    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state === "denied") {
          setError("Location permission blocked hai. Browser site settings mein Location ko Allow karein, phir page refresh karein.");
          return;
        }
      }
      const position = await readBestLocation();
      const accuracy = Math.round(position.coords.accuracy);
      if (accuracy > 100) {
        setError(`GPS accuracy abhi ${accuracy}m hai. Phone ko khuli jagah par rakh kar GPS lock hone dein, phir dobara try karein.`);
        return;
      }
      const location = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      const data = action === "in" ? await checkInAttendance(location) : await checkOutAttendance(location);
      setNotice(data.message); await Promise.all([loadToday(), loadHistory()]);
    } catch (geoOrRequestError) {
      if (geoOrRequestError?.code === 1) setError("Location permission allow karein. Agar popup nahi aa raha to browser site settings mein Location ko Allow karein, phir page refresh karein.");
      else if (geoOrRequestError?.code === 2) setError("GPS signal nahi mil raha. Khuli jagah par ja kar dobara try karein.");
      else if (geoOrRequestError?.code === 3) setError("GPS reading mein zyada waqt lag raha hai. Dobara try karein.");
      else setError(geoOrRequestError.response?.data?.message || "Attendance action could not be completed.");
    } finally { setWorking(false); }
  };

  const signOut = async () => { await logout(); };
  if (user?.role !== "employee") return <Navigate to="/admin/dashboard" replace />;

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8"><div className="mx-auto max-w-6xl"><header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 no-underline" to="/dashboard">← Back to workspace</Link><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-violet-600">Employee workspace</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">Attendance</h1><p className="mt-2 text-sm text-slate-500">Check in and out securely from your approved office location.</p></div><button onClick={signOut} className="inline-flex items-center gap-2 self-start text-sm font-bold text-slate-500 hover:text-slate-900"><LogOut size={16} /> Sign out</button></header>{error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}{notice && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p>}
    <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Today · Karachi time</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{dayjs().tz(zone).format("dddd, DD MMMM YYYY")}</h2></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Clock3 size={25} /></div></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Check in</span><strong className="mt-1 block text-lg text-slate-900">{loading ? "Loading..." : timeValue(today?.record?.checkIn)}</strong><span className="mt-1 block text-xs capitalize text-slate-400">{today?.record?.status || "Not checked in"}</span></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Check out</span><strong className="mt-1 block text-lg text-slate-900">{loading ? "Loading..." : timeValue(today?.record?.checkOut)}</strong><span className="mt-1 block text-xs text-slate-400">Worked {minutesValue(today?.record?.workedMinutes)}</span></div></div><div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900"><LocateFixed size={17} className="mr-2 inline" />GPS location and accuracy are verified by the server before attendance is recorded.</div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={() => locateAndSubmit("in")} disabled={working || !today?.state?.canCheckIn} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><MapPin size={18} />{working ? "Reading location..." : "Check in"}</button><button onClick={() => locateAndSubmit("out")} disabled={working || !today?.state?.canCheckOut} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-5 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={18} />Check out</button></div>{today?.state?.reason && <p className="mt-3 text-center text-xs font-semibold text-slate-500">{today.state.reason}</p>}</div><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-700"><CalendarDays size={22} /></div><div><h2 className="font-bold text-slate-900">Attendance history</h2><p className="text-xs text-slate-500">Up to 100 records</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-600">From<input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold text-slate-600">To<input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div><button onClick={loadHistory} disabled={historyLoading} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-60"><RefreshCw size={14} />{historyLoading ? "Loading..." : "Apply dates"}</button><div className="mt-6 grid gap-3">{historyLoading ? <p className="text-sm text-slate-400">Loading history...</p> : history.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No attendance records for this range.</p> : history.map((record) => <div className="rounded-xl border border-slate-100 p-3" key={record.id}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-800">{dayjs(record.date).format("DD MMM YYYY")}</strong><span className={`text-xs font-bold capitalize ${record.status === "late" ? "text-amber-600" : "text-emerald-600"}`}>{record.status}</span></div><p className="mt-2 text-xs text-slate-500">{timeValue(record.checkIn)} → {timeValue(record.checkOut)} · {minutesValue(record.workedMinutes)}</p></div>)}</div></section></section></div></main>;
}
