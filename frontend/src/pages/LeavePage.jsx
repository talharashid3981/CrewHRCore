import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, FileText, LoaderCircle, XCircle } from "lucide-react";
import { applyLeave, cancelLeave, getMyLeaveBalance, getMyLeaves, listLeaveTypes, previewLeave } from "../api/auth.api";

const today = () => new Date().toISOString().slice(0, 10);
const year = () => new Date().getFullYear();
const statusStyle = { pending: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700", cancelled: "bg-slate-100 text-slate-600" };

export default function LeavePage() {
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ leaveType: "", from: today(), to: today(), reason: "" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBalance = useMemo(() => balances.find((item) => String(item.leaveType) === String(form.leaveType)), [balances, form.leaveType]);
  const load = async () => {
    setLoading(true); setError("");
    try {
      const [typeData, balanceData, leaveData] = await Promise.all([listLeaveTypes(), getMyLeaveBalance(year()), getMyLeaves(filter ? { status: filter, year: year() } : { year: year() })]);
      setTypes(typeData.leaveTypes || []); setBalances(balanceData.balances || []); setLeaves(leaveData.leaves || []);
      if (!form.leaveType && typeData.leaveTypes?.[0]) setForm((current) => ({ ...current, leaveType: typeData.leaveTypes[0]._id }));
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to load leave data."); }
    finally { setLoading(false); }
  };
  // The delayed call keeps the initial effect free of synchronous state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [filter]);
  useEffect(() => {
    if (!form.from || !form.to || form.from > form.to) return undefined;
    const timer = setTimeout(() => previewLeave({ from: form.from, to: form.to }).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(timer);
  }, [form.from, form.to]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { const result = await applyLeave(form); setMessage(result.message || "Leave request submitted."); setForm((current) => ({ ...current, reason: "" })); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to submit leave request."); }
    finally { setSaving(false); }
  };
  const cancel = async (id) => {
    if (!window.confirm("Cancel this leave request?")) return;
    setError(""); setMessage("");
    try { const result = await cancelLeave(id); setMessage(result.message || "Leave request cancelled."); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to cancel this request."); }
  };

  return <main className="w-full font-sans text-slate-800"><header className="mb-7 flex flex-col gap-2"><p className="text-xs font-medium uppercase tracking-[.18em] text-violet-600">Employee workspace</p><h1 className="text-[32px] font-bold tracking-tight text-slate-950">Leave management</h1><p className="text-[14px] font-normal text-slate-500">Apply for leave, track approvals, and review your yearly balance.</p></header>
    {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700" role="alert">{error}</p>}{message && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700" role="status">{message}</p>}
    <section className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{balances.map((balance) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={balance.leaveType}><div className="flex items-center justify-between"><p className="text-[14px] font-medium text-slate-500">{balance.name}</p><CalendarDays className="text-violet-500" size={19} /></div><strong className="mt-3 block text-2xl font-bold text-slate-950">{balance.available}</strong><p className="mt-1 text-[12px] text-slate-400">available of {balance.yearlyQuota} days · {balance.pending} pending</p></article>)}</section>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><FileText size={19} /></span><div><h2 className="text-[18px] font-semibold text-slate-900">Apply for leave</h2><p className="text-[12px] text-slate-500">Requests are reviewed by an administrator.</p></div></div><div className="grid gap-4"><label className="grid gap-1.5 text-[14px] font-medium text-slate-700">Leave type<select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" name="leaveType" value={form.leaveType} onChange={update} required><option value="">Select leave type</option>{types.map((type) => <option value={type._id} key={type._id}>{type.name} · {type.yearlyQuota} days</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-[14px] font-medium text-slate-700">From<input className="h-11 rounded-xl border border-slate-200 px-3 text-[14px] font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" name="from" type="date" min={today()} value={form.from} onChange={update} required /></label><label className="grid gap-1.5 text-[14px] font-medium text-slate-700">To<input className="h-11 rounded-xl border border-slate-200 px-3 text-[14px] font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" name="to" type="date" min={form.from || today()} value={form.to} onChange={update} required /></label></div>{preview && <div className="rounded-xl bg-violet-50 px-3 py-3 text-[14px] text-violet-800">{preview.days} working day{preview.days === 1 ? "" : "s"} selected{selectedBalance ? ` · ${selectedBalance.available} available` : ""}</div>}<label className="grid gap-1.5 text-[14px] font-medium text-slate-700">Reason<textarea className="min-h-28 resize-y rounded-xl border border-slate-200 px-3 py-3 text-[14px] font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" name="reason" value={form.reason} onChange={update} minLength={3} maxLength={500} placeholder="Briefly explain your request" required /></label><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-[15px] font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60" disabled={saving || !types.length}>{saving && <LoaderCircle className="animate-spin" size={17} />}{saving ? "Submitting..." : "Submit request"}</button></div></form>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-[18px] font-semibold text-slate-900">My leave requests</h2><p className="text-[12px] text-slate-500">Your requests for {year()}.</p></div><select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px] outline-none" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{["pending", "approved", "rejected", "cancelled"].map((status) => <option value={status} key={status}>{status}</option>)}</select></div>{loading ? <p className="text-[14px] text-slate-400">Loading requests...</p> : leaves.length === 0 ? <div className="grid min-h-48 place-items-center text-center text-[14px] text-slate-400"><Clock3 size={28} /><p>No leave requests found.</p></div> : <div className="grid gap-3">{leaves.map((leave) => <article className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={leave.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[14px] font-semibold text-slate-900">{leave.leaveType?.name || "Leave"}</h3><p className="mt-1 text-[12px] text-slate-500">{leave.from} to {leave.to} · {leave.days} day{leave.days === 1 ? "" : "s"}</p></div><span className={`rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${statusStyle[leave.status] || statusStyle.cancelled}`}>{leave.status}</span></div><p className="mt-3 text-[14px] text-slate-600">{leave.reason}</p>{leave.reviewNote && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">Admin note: {leave.reviewNote}</p>}{(leave.status === "pending" || (leave.status === "approved" && leave.from > today())) && <button className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-red-600 hover:text-red-800" onClick={() => cancel(leave.id)}><XCircle size={15} /> Cancel request</button>}</article>)}</div>}</section></div>
  </main>;
}
