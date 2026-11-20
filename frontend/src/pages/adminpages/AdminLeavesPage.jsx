import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  approveLeave,
  createLeaveType,
  exportLeaveRequests,
  getAdminLeaveDetail,
  getLeavePolicy,
  getEmployeeSummary,
  listHolidays,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeave,
  updateLeavePolicy,
  updateLeaveType,
  getOfficeSettings,
} from "../../api/auth.api";

const statusStyle = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

const defaultPolicy = {
  allowHalfDay: true,
  requireReason: true,
  allowPastDatedRequests: false,
  pastDatedLimitDays: 7,
  leaveYearStart: "01-01",
};

const emptyType = {
  name: "",
  yearlyQuota: 14,
  isUnlimited: false,
  description: "",
  carryForwardDays: 0,
  documentRequiredAfterDays: null,
  minimumNoticeDays: 0,
  isActive: true,
};

const formatDate = (value, options = { day: "2-digit", month: "short", year: "numeric" }) =>
  value ? new Intl.DateTimeFormat("en", { timeZone: "UTC", ...options }).format(new Date(`${value}T12:00:00Z`)) : "—";
const formatTime = (value) => value
  ? new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value))
  : "";

const initials = (value = "") =>
  value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "EM";

export default function AdminLeavesPage({ user }) {
  const [tab, setTab] = useState("requests");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [sort, setSort] = useState("soonest");
  const [page, setPage] = useState(1);
  const [leaves, setLeaves] = useState([]);
  const [decidedToday, setDecidedToday] = useState([]);
  const [startsThisWeek, setStartsThisWeek] = useState(0);
  const [decidedTodayCount, setDecidedTodayCount] = useState(0);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [policyDraft, setPolicyDraft] = useState(defaultPolicy);
  const [office, setOffice] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [editingType, setEditingType] = useState(null);
  const [typeModal, setTypeModal] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestSequence = useRef(0);

  const loadRequests = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await listLeaveRequests({
        status: status === "all" ? undefined : status,
        search,
        department,
        leaveType: leaveType || undefined,
        sort,
        page,
        limit: 8,
      });
      if (sequence !== requestSequence.current) return;
      const nextLeaves = result.leaves || [];
      setLeaves(nextLeaves);
      setCounts(result.counts || {});
      setDecidedToday(result.decidedToday || []);
      setStartsThisWeek(result.startsThisWeek || 0);
      setDecidedTodayCount(result.decidedTodayCount || 0);
      setPagination(result.pagination || { page: 1, pages: 1, total: 0 });
      setSelectedId((current) => {
        if (current && nextLeaves.some((leave) => leave.id === current)) return current;
        return nextLeaves[0]?.id || "";
      });
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      setError(requestError.response?.data?.message || "Unable to load leave requests.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }

  }, [status, search, department, leaveType, sort, page]);

  const loadPolicy = useCallback(async () => {
    try {
      const [typeData, policyData, officeData, holidayData, employeeData] = await Promise.all([
        listLeaveTypes({ all: "true" }),
        getLeavePolicy(),
        getOfficeSettings(),
        listHolidays({ from: `${new Date().getFullYear()}-01-01` }),
        getEmployeeSummary(),
      ]);
      setTypes(typeData.leaveTypes || []);
      const nextPolicy = policyData.policy || defaultPolicy;
      setPolicy(nextPolicy);
      setPolicyDraft(nextPolicy);
      setOffice(officeData.settings || null);
      setHolidays(holidayData.holidays || []);
      setDepartments(employeeData.departments || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load leave policy.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadRequests(), 250);
    return () => clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPolicy(), 0);
    return () => clearTimeout(timer);
  }, [loadPolicy]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedId) {
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      getAdminLeaveDetail(selectedId)
        .then((result) => active && setDetail(result))
          .catch((requestError) => active && setError(requestError.response?.data?.message || "Unable to load request details."))
        .finally(() => active && setDetailLoading(false));
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [selectedId, detailRevision]);

  const actOnLeave = async (callback, success) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await callback();
      setMessage(result.message || success);
      setRejectNote("");
      setDetail(null);
      setDetailRevision((revision) => revision + 1);
      await loadRequests();
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update leave request.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!selectedLeave || rejectNote.trim().length < 3) return;
    const succeeded = await actOnLeave(
      () => rejectLeave(selectedLeave.id, rejectNote.trim()),
      "Leave request rejected.",
    );
    if (succeeded) setRejectNote("");
  };

  const saveType = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = {
        ...typeForm,
        yearlyQuota: typeForm.isUnlimited ? 0 : Number(typeForm.yearlyQuota),
        documentRequiredAfterDays: typeForm.documentRequiredAfterDays === ""
          ? null
          : typeForm.documentRequiredAfterDays === null
            ? null
            : Number(typeForm.documentRequiredAfterDays),
      };
      const result = editingType
        ? await updateLeaveType(editingType._id, data)
        : await createLeaveType(data);
      setMessage(result.message || "Leave type saved.");
      setTypeModal(false);
      setEditingType(null);
      setTypeForm(emptyType);
      setTypes((current) => {
        const next = editingType
          ? current.map((type) => type._id === result.leaveType._id ? result.leaveType : type)
          : [...current, result.leaveType];
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save leave type.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTypeActive = async (type, isActive) => {
    setSaving(true);
    setError("");
    try {
      const result = await updateLeaveType(type._id, { isActive });
      setTypes((current) => current.map((item) => item._id === type._id ? result.leaveType : item));
      setMessage(result.message || "Leave type updated.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update leave type.");
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async () => {
    const [month, day] = (policyDraft.leaveYearStart || "").split("-").map(Number);
    const validDate = /^\d{2}-\d{2}$/.test(policyDraft.leaveYearStart || "")
      && month >= 1 && month <= 12
      && day >= 1 && day <= new Date(Date.UTC(2000, month, 0)).getUTCDate();
    if (!validDate) {
      setError("Enter a valid leave-year start date in MM-DD format.");
      return;
    }
    if (policyDraft.allowPastDatedRequests
      && (!Number.isInteger(policyDraft.pastDatedLimitDays) || policyDraft.pastDatedLimitDays < 1 || policyDraft.pastDatedLimitDays > 30)) {
      setError("Past-dated requests must be limited to 1–30 days.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await updateLeavePolicy(policyDraft);
      setPolicy(result.policy || policyDraft);
      setPolicyDraft(result.policy || policyDraft);
      setMessage("Leave policy saved.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save leave policy.");
    } finally {
      setSaving(false);
    }
  };

  const exportRows = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await exportLeaveRequests({ status, search, department, leaveType: leaveType || undefined, sort });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export leave requests.");
    } finally {
      setExporting(false);
    }
  };

  const pendingCount = counts.pending || 0;
  const currentDetail = String(detail?.leave?.id || "") === String(selectedId) ? detail : null;
  const selectedLeave = currentDetail?.leave || leaves.find((leave) => String(leave.id) === String(selectedId));

  return (
    <main className="min-w-0 font-['Inter',sans-serif] text-slate-800">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold tracking-[-.5px] text-slate-950">Leave management</h1>
          <p className="mt-1 text-[12px] text-slate-500">Review leave requests and maintain leave policy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabButton compact active={tab === "requests"} onClick={() => setTab("requests")} badge={pendingCount}>Requests</TabButton>
            <TabButton compact active={tab === "policy"} onClick={() => setTab("policy")}>Leave policy</TabButton>
          </div>
          <button
            type="button"
            onClick={exportRows}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:border-violet-200 hover:text-violet-700 disabled:opacity-60"
          >
            {exporting ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}
            Export
          </button>
          <button type="button" onClick={() => { setStatus("pending"); setTab("requests"); }} aria-label="View pending requests" className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-violet-700">
            <Bell size={16} />
            {pendingCount > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />}
          </button>
          <div className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 font-['Poppins',sans-serif] text-[9px] font-semibold text-white">{initials(user?.name)}</span>
            <span className="max-w-24 truncate text-[11px] font-medium text-slate-700">{user?.name?.split(" ")[0] || "Admin"}</span>
          </div>
        </div>
      </header>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700" role="alert">{error}</p>}
      {message && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700" role="status">{message}</p>}

      {tab === "requests" ? (
        <>
          <section className="mb-3 flex flex-wrap gap-1.5">
            {[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancelled", "Cancelled"], ["all", "All"]].map(([value, label]) => (
              <button type="button" key={value} onClick={() => { setPage(1); setStatus(value); setSelectedId(""); setRejectNote(""); }} className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[11px] font-semibold transition ${status === value ? "bg-gradient-to-r from-[#7116b9] to-[#853de8] text-white shadow-[0_5px_12px_rgba(124,58,237,.22)]" : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"}`}>
                {label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${status === value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{value === "all" ? counts.all || 0 : counts[value] || 0}</span>
              </button>
            ))}
          </section>

          <section className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={search}
                onChange={(event) => { setPage(1); setSearch(event.target.value); setRejectNote(""); }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                placeholder="Search employee or department..."
              />
            </label>
            <SelectControl value={leaveType} onChange={(value) => { setPage(1); setLeaveType(value); setRejectNote(""); }} placeholder="Leave type: All" options={types.map((item) => [item._id, item.name])} />
            <SelectControl value={department} onChange={(value) => { setPage(1); setDepartment(value); setRejectNote(""); }} placeholder="Department: All" options={departments.map((item) => [item, item])} />
            <SelectControl value={sort} onChange={(value) => { setSort(value); setRejectNote(""); }} placeholder="Sort" options={[["soonest", "Starts soonest"], ["newest", "Newest first"], ["oldest", "Oldest first"]]} />
          </section>

          <div className="grid min-w-0 items-stretch gap-4 min-[1200px]:grid-cols-[minmax(0,1.08fr)_minmax(390px,.92fr)]">
            <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,.035)] sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <h2 className="text-[13px] font-semibold text-slate-900">
                  {status === "pending" ? "Pending requests" : status === "all" ? "Leave requests" : `${status[0].toUpperCase()}${status.slice(1)} requests`}
                </h2>
                <span className="text-[10px] text-slate-500">
                  {status === "pending" ? `${startsThisWeek} start${startsThisWeek === 1 ? "s" : ""} this week` : `${pagination.total || 0} requests`}
                </span>
              </div>
              {loading ? (
                <LoadingRows />
              ) : leaves.length === 0 ? (
                <div className="grid min-h-52 flex-1 place-items-center px-6 text-center">
                  <div>
                    <CalendarDays className="mx-auto mb-3 text-violet-300" size={28} />
                    <p className="text-[13px] font-semibold text-slate-700">No requests match these filters</p>
                    <p className="mt-1 text-[11px] text-slate-400">Try another status, leave type, or department.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaves.map((leave) => (
                    <RequestRow
                      key={leave.id}
                      leave={leave}
                      selected={String(selectedId) === String(leave.id)}
                      onClick={() => { setSelectedId(leave.id); setRejectNote(""); }}
                    />
                  ))}
                </div>
              )}
              {(status === "pending" || status === "all") && decidedToday.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <h3 className="text-[12px] font-semibold text-slate-900">Decided today</h3>
                    <span className="text-[10px] text-slate-500">{decidedTodayCount} request{decidedTodayCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-1">
                    {decidedToday.map((leave) => <DecidedRow key={leave.id} leave={leave} />)}
                  </div>
                </div>
              )}
              <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-1 pt-3">
                <span className="text-[10px] text-slate-500">{pagination.total || 0} requests</span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => { setPage(page - 1); setRejectNote(""); }} className="grid size-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="px-2 text-[10px] font-medium text-slate-500">{pagination.page || page} / {Math.max(pagination.pages || 1, 1)}</span>
                  <button type="button" aria-label="Next page" disabled={page >= (pagination.pages || 1)} onClick={() => { setPage(page + 1); setRejectNote(""); }} className="grid size-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            </section>

            <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white">
              {detailLoading ? (
                <div className="grid min-h-96 place-items-center"><LoaderCircle className="animate-spin text-violet-600" size={22} /></div>
              ) : selectedLeave ? (
                <div className="flex min-h-[420px] min-w-0 flex-col">
                  <div className="border-b border-slate-100 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 font-['Poppins',sans-serif] text-[12px] font-semibold text-white shadow-sm">
                        {initials(selectedLeave.employee?.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[14px] font-semibold text-slate-900">{selectedLeave.employee?.name || "Employee"}</h2>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{[selectedLeave.employee?.designation, selectedLeave.employee?.department].filter(Boolean).join(" · ") || selectedLeave.employee?.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${statusStyle[selectedLeave.status] || statusStyle.cancelled}`}>{selectedLeave.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3.5">
                      <DetailLine label="Leave type" value={selectedLeave.leaveType?.name || "Leave"} />
                      <DetailLine
                        label="Dates"
                        value={selectedLeave.from === selectedLeave.to
                          ? formatDate(selectedLeave.from, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                          : `${formatDate(selectedLeave.from, { day: "numeric", month: "short" })} – ${formatDate(selectedLeave.to, { day: "numeric", month: "short", year: "numeric" })}`}
                      />
                      <DetailLine
                        label="Working days"
                        value={currentDetail
                          ? `${currentDetail.workingDays}${selectedLeave.duration === "half" ? " · half day" : ""} · ${currentDetail.weekendDays} weekend · ${currentDetail.holidayDays} holiday`
                          : `${selectedLeave.days}${selectedLeave.duration === "half" ? " · half day" : ""}`}
                      />
                      <DetailLine label="Reason" value={selectedLeave.reason || "No reason provided"} />
                      {selectedLeave.documentReference && (
                        <DetailLine
                          label="Document"
                          value={<a href={selectedLeave.documentReference} target="_blank" rel="noreferrer" className="font-medium text-violet-700 underline decoration-violet-200 underline-offset-2">Open supporting document</a>}
                        />
                      )}
                      {selectedLeave.reviewNote && <DetailLine label="Review note" value={selectedLeave.reviewNote} danger />}
                    </div>

                    {currentDetail?.balance && (
                      <div className="rounded-xl border border-violet-100 bg-[#FBF9FF] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-slate-700">Balance impact</p>
                          <p className="text-right text-[11px] font-semibold text-slate-900">
                            {currentDetail.balance.isUnlimited
                              ? "No fixed limit"
                              : `${currentDetail.balance.remaining} days left → ${Math.max(0, currentDetail.balance.remaining - (selectedLeave.status === "pending" ? selectedLeave.days : 0))} after approval`}
                          </p>
                        </div>
                        {!currentDetail.balance.isUnlimited && (
                          <>
                            <BalanceBar
                              used={currentDetail.balance.approved}
                              request={selectedLeave.status === "pending" ? selectedLeave.days : 0}
                              remaining={Math.max(0, currentDetail.balance.effectiveQuota - currentDetail.balance.approved - (selectedLeave.status === "pending" ? selectedLeave.days : 0))}
                              total={currentDetail.balance.effectiveQuota}
                            />
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500">
                              <span><i className="mr-1 inline-block size-1.5 rounded-full bg-violet-700" />Used {currentDetail.balance.approved}</span>
                              {selectedLeave.status === "pending" && <span><i className="mr-1 inline-block size-1.5 rounded-full bg-amber-500" />This request {selectedLeave.days}</span>}
                              <span><i className="mr-1 inline-block size-1.5 rounded-full bg-violet-200" />Remaining {Math.max(0, currentDetail.balance.effectiveQuota - currentDetail.balance.approved - (selectedLeave.status === "pending" ? selectedLeave.days : 0))}</span>
                            </div>
                            {currentDetail.balance.pending > selectedLeave.days && selectedLeave.status === "pending" && (
                              <p className="mt-1.5 text-[9px] text-slate-500">Additional pending requests are excluded from this impact.</p>
                            )}
                          </>
                        )}
                        {currentDetail.balance.isUnlimited && (
                          <p className="mt-1 text-[10px] text-slate-500">This leave type has no fixed quota.</p>
                        )}
                      </div>
                    )}

                    {currentDetail?.teamConflict && (
                      <div className={`flex items-start gap-2 rounded-xl border p-3 ${currentDetail.teamConflict.count ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
                        <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${currentDetail.teamConflict.count ? "text-amber-700" : "text-emerald-700"}`}>
                          {currentDetail.teamConflict.count ? <AlertTriangle size={13} /> : <Check size={13} />}
                        </span>
                        <div>
                          <p className={`text-[10px] font-semibold ${currentDetail.teamConflict.count ? "text-amber-800" : "text-emerald-800"}`}>
                            {currentDetail.teamConflict.count ? "Team availability conflict" : "No team conflict"}
                          </p>
                          <p className={`mt-0.5 text-[9px] leading-4 ${currentDetail.teamConflict.count ? "text-amber-700" : "text-emerald-700"}`}>
                            {currentDetail.teamConflict.count
                              ? `${currentDetail.teamConflict.employees.map((employee) => `${employee.name} (${employee.status})`).join(", ")} overlaps these dates in ${currentDetail.teamConflict.department}.`
                              : `No one else in ${currentDetail.teamConflict.department} is off during these dates.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedLeave.status === "pending" && (
                      <div className="mt-auto space-y-3">
                        <label className="block">
                          <span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-700">
                            Review note
                            <span className="font-normal text-slate-400">Required to reject</span>
                          </span>
                          <textarea
                            value={rejectNote}
                            onChange={(event) => setRejectNote(event.target.value)}
                            minLength={3}
                            maxLength={500}
                            className="min-h-[54px] w-full resize-y rounded-xl border border-violet-100 bg-[#FBFAFF] px-3 py-2 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                            placeholder={`Add a note for ${selectedLeave.employee?.name?.split(" ")[0] || "employee"}`}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button type="button" disabled={saving || rejectNote.trim().length < 3} onClick={reject} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? <LoaderCircle className="animate-spin" size={14} /> : <X size={14} />} Reject
                          </button>
                          <button type="button" disabled={saving || !currentDetail} onClick={() => actOnLeave(() => approveLeave(selectedLeave.id), "Leave approved.")} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7116b9] to-[#853de8] text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(124,58,237,.22)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />} Approve
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedLeave.status !== "pending" && selectedLeave.reviewedAt && (
                      <p className="mt-auto border-t border-slate-100 pt-3 text-[10px] text-slate-400">Reviewed {formatDate(selectedLeave.reviewedAt.slice(0, 10))} at {formatTime(selectedLeave.reviewedAt)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[420px] place-items-center px-6 text-center text-[12px] text-slate-400">Select a request to view its details.</div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <LeavePolicy
          types={types}
          policy={policyDraft}
          setPolicy={setPolicyDraft}
          office={office}
          holidays={holidays}
          saving={saving}
          onSave={savePolicy}
          onDiscard={() => setPolicyDraft(policy)}
          onAdd={() => {
            setEditingType(null);
            setTypeForm(emptyType);
            setTypeModal(true);
          }}
          onEdit={(type) => {
            setEditingType(type);
            setTypeForm({
              name: type.name,
              yearlyQuota: type.yearlyQuota,
              isUnlimited: Boolean(type.isUnlimited),
              description: type.description || "",
              carryForwardDays: type.carryForwardDays || 0,
              documentRequiredAfterDays: type.documentRequiredAfterDays ?? null,
              minimumNoticeDays: type.minimumNoticeDays || 0,
              isActive: type.isActive,
            });
            setTypeModal(true);
          }}
          onToggleActive={toggleTypeActive}
        />
      )}

      {typeModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form onSubmit={saveType} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h2 className="text-[16px] font-semibold text-slate-900">{editingType ? "Edit leave type" : "Add leave type"}</h2><p className="mt-1 text-[12px] text-slate-500">Configure quota and request requirements.</p></div>
              <button type="button" onClick={() => setTypeModal(false)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><input value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} minLength={2} maxLength={50} required /></Field>
              <Field label="Yearly quota"><input type="number" min="0" max="365" value={typeForm.yearlyQuota} onChange={(event) => setTypeForm({ ...typeForm, yearlyQuota: event.target.value })} disabled={typeForm.isUnlimited} required={!typeForm.isUnlimited} /></Field>
              <Field label="Carry forward"><input type="number" min="0" max="365" value={typeForm.carryForwardDays} onChange={(event) => setTypeForm({ ...typeForm, carryForwardDays: Number(event.target.value) })} /></Field>
              <Field label="Document after (days)"><input type="number" min="0" max="365" value={typeForm.documentRequiredAfterDays ?? ""} onChange={(event) => setTypeForm({ ...typeForm, documentRequiredAfterDays: event.target.value === "" ? null : Number(event.target.value) })} placeholder="No requirement" /></Field>
              <Field label="Minimum notice"><input type="number" min="0" max="365" value={typeForm.minimumNoticeDays} onChange={(event) => setTypeForm({ ...typeForm, minimumNoticeDays: Number(event.target.value) })} /></Field>
              <Field label="Description" className="sm:col-span-2"><input value={typeForm.description} onChange={(event) => setTypeForm({ ...typeForm, description: event.target.value })} maxLength={200} /></Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle checked={typeForm.isUnlimited} onChange={(checked) => setTypeForm({ ...typeForm, isUnlimited: checked })} label="Unlimited leave" />
              <Toggle checked={typeForm.isActive} onChange={(checked) => setTypeForm({ ...typeForm, isActive: checked })} label="Active leave type" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setTypeModal(false)} className="h-10 px-4 text-[12px] font-semibold text-slate-500">Cancel</button>
              <button type="submit" disabled={saving} className="h-10 rounded-xl bg-violet-700 px-4 text-[12px] font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editingType ? "Update type" : "Create type"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function TabButton({ active, badge, onClick, children, compact = false }) {
  return (
    <button type="button" onClick={onClick} className={`relative inline-flex items-center gap-2 rounded-lg text-[11px] font-semibold transition ${compact ? "h-8 px-3" : "h-11 px-4"} ${active ? compact ? "bg-gradient-to-r from-[#7116b9] to-[#853de8] text-white shadow-[0_4px_10px_rgba(124,58,237,.2)]" : "text-violet-700" : "text-slate-500 hover:text-slate-800"}`}>
      {children}
      {badge > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${compact && active ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>{badge}</span>}
      {active && !compact && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-600" />}
    </button>
  );
}

function RequestRow({ leave, selected, onClick }) {
  const typeName = leave.leaveType?.name || "Leave";
  const typeClass = /sick/i.test(typeName)
    ? "bg-emerald-50 text-emerald-700"
    : /casual/i.test(typeName)
      ? "bg-amber-50 text-amber-700"
      : /annual/i.test(typeName)
        ? "bg-violet-50 text-violet-700"
        : "bg-slate-100 text-slate-600";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 text-left transition sm:grid-cols-[38px_minmax(0,1fr)_auto] ${selected ? "border-violet-500 bg-[#FCFAFF] ring-2 ring-violet-100" : "border-slate-100 bg-white hover:border-violet-200 hover:bg-violet-50/30"}`}
    >
      <span className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 font-['Poppins',sans-serif] text-[10px] font-semibold text-white">{initials(leave.employee?.name)}</span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold text-slate-900">{leave.employee?.name || "Employee"}</span>
          <span className="shrink-0 text-[9px] text-slate-400">{formatTime(leave.createdAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-slate-500">{[leave.employee?.department, leave.employee?.designation].filter(Boolean).join(" · ") || leave.employee?.email}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${typeClass}`}><i className="size-1.5 rounded-full bg-current" />{typeName}</span>
          <span className="text-[9px] text-slate-500">
            {formatDate(leave.from, { weekday: "short", day: "numeric", month: "short" })}
            {leave.from !== leave.to && ` – ${formatDate(leave.to, { weekday: "short", day: "numeric", month: "short" })}`}
            {" · "}{leave.days} working day{leave.days === 1 ? "" : "s"}
          </span>
        </span>
      </span>
      <span className="hidden text-right text-[9px] text-slate-400 sm:block">{formatDate(leave.createdAt?.slice(0, 10), { day: "numeric", month: "short" })}</span>
    </button>
  );
}

function DecidedRow({ leave }) {
  const approved = leave.status === "approved";
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1.5 py-1.5">
      <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-[8px] font-bold text-white">{initials(leave.employee?.name)}</span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-semibold text-slate-800">{leave.employee?.name || "Employee"}</span>
        <span className="block truncate text-[9px] text-slate-500">{leave.leaveType?.name || "Leave"} · {formatDate(leave.from, { weekday: "short", day: "numeric", month: "short" })} · {leave.days} working day{leave.days === 1 ? "" : "s"}</span>
      </span>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${approved ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
        {approved ? "Approved" : "Rejected"}{formatTime(leave.reviewedAt) && ` ${formatTime(leave.reviewedAt)}`}
      </span>
    </div>
  );
}

function BalanceBar({ used, request, remaining, total }) {
  const denominator = Math.max(Number(total) || 0, 0.5);
  const usedWidth = Math.min(100, (used / denominator) * 100);
  const requestWidth = Math.min(100 - usedWidth, (request / denominator) * 100);
  const remainingWidth = Math.max(0, 100 - usedWidth - requestWidth);
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-violet-100" aria-label={`${used} days used, ${request} days requested, ${remaining} days remaining`}>
      <span className="bg-violet-800" style={{ width: `${usedWidth}%` }} />
      <span className="bg-amber-500" style={{ width: `${requestWidth}%` }} />
      <span className="bg-violet-200" style={{ width: `${remainingWidth}%` }} />
    </div>
  );
}

function DetailLine({ label, value, danger = false }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 py-2 text-[10px] sm:grid-cols-[92px_minmax(0,1fr)]">
      <span className="text-slate-500">{label}</span>
      <span className={`min-w-0 break-words font-semibold ${danger ? "text-rose-700" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function SelectControl({ value, onChange, placeholder, options }) {
  return (
    <label className="relative">
      <span className="sr-only">{placeholder}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-40 max-w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[12px] font-medium text-slate-600 outline-none focus:border-violet-400">
        <option value="">{placeholder}</option>
        {options.map(([optionValue, label]) => <option value={optionValue} key={optionValue}>{label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
    </label>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-4">
          <span className="size-11 animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2"><span className="block h-3 w-32 animate-pulse rounded bg-slate-100" /><span className="block h-2.5 w-48 max-w-full animate-pulse rounded bg-slate-100" /></div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`grid gap-1.5 text-[11px] font-semibold text-slate-700 ${className}`}>
      {label}
      <span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:bg-white [&>input]:px-3 [&>input]:text-[12px] [&>input]:font-normal [&>input]:text-slate-800 [&>input]:outline-none [&>input:focus]:border-violet-400 [&>input:disabled]:bg-slate-100 [&>input:disabled]:text-slate-400">{children}</span>
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
      <span className="text-[11px] font-semibold text-slate-700">{label}</span>
      <input className="size-4 accent-violet-600" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function LeavePolicy({ types, policy, setPolicy, office, holidays, saving, onSave, onDiscard, onAdd, onEdit, onToggleActive }) {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekendDays = office?.weekendDays || [0, 6];
  const upcomingHolidays = holidays.slice(0, 2);
  const parsedStart = /^((0[1-9]|1[0-2]))-(0[1-9]|[12]\d|3[01])$/.exec(policy.leaveYearStart || "");
  const month = parsedStart ? Number(parsedStart[1]) : 1;
  const day = parsedStart ? Number(parsedStart[3]) : 1;
  const firstYearDay = Math.min(day, new Date(Date.UTC(2026, month, 0)).getUTCDate());
  const secondYearDay = Math.min(day, new Date(Date.UTC(2027, month, 0)).getUTCDate());
  const resetLabel = `${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, firstYearDay)))} – ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2027, month - 1, secondYearDay) - 86400000))}`;
  const policyToggle = (key, label, description) => (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div><p className="text-[12px] font-semibold text-slate-800">{label}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p></div>
      <label className="relative mt-0.5 inline-flex cursor-pointer items-center">
        <input type="checkbox" checked={Boolean(policy[key])} onChange={(event) => setPolicy({ ...policy, [key]: event.target.checked })} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-violet-600 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4" />
      </label>
    </div>
  );
  return (
    <div className="grid gap-4 min-[1200px]:grid-cols-[minmax(0,1.5fr)_minmax(320px,.9fr)]">
      <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.035)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-[14px] font-semibold text-slate-900">Leave types</h2><p className="mt-0.5 text-[10px] text-slate-500">Quotas apply to every approved employee.</p></div>
        </div>
        <div className="hidden grid-cols-[minmax(105px,1.2fr)_minmax(55px,.55fr)_minmax(75px,.8fr)_minmax(86px,.9fr)_minmax(70px,.8fr)_38px] gap-2 border-b border-slate-100 px-2 pb-2 text-[9px] font-semibold text-slate-500 sm:grid">
          <span>Type</span><span>Days / year</span><span>Carry forward</span><span>Document</span><span>Min. notice</span><span>Active</span>
        </div>
        <div className="divide-y divide-slate-100">
          {types.map((type) => (
            <article key={type._id} className="grid grid-cols-[minmax(0,1fr)_34px] gap-x-3 gap-y-2 px-2 py-3 sm:grid-cols-[minmax(105px,1.2fr)_minmax(55px,.55fr)_minmax(75px,.8fr)_minmax(86px,.9fr)_minmax(70px,.8fr)_38px] sm:items-center">
              <button type="button" onClick={() => onEdit(type)} className="flex min-w-0 items-center gap-2 text-left hover:text-violet-700">
                <i className={`size-2 shrink-0 rounded-full ${type.isActive ? "bg-violet-600" : "bg-slate-300"}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-slate-800">{type.name}</span>
                  <span className="block truncate text-[9px] text-slate-400 sm:hidden">{type.description || "Edit leave type"}</span>
                </span>
              </button>
              <PolicyMetric label="Days / year" value={type.isUnlimited ? "No limit" : type.yearlyQuota} />
              <PolicyMetric label="Carry forward" value={type.carryForwardDays ? `Up to ${type.carryForwardDays} days` : "None"} />
              <PolicyMetric label="Document" value={type.documentRequiredAfterDays == null ? "Not required" : `After ${type.documentRequiredAfterDays} days`} />
              <PolicyMetric label="Min. notice" value={type.minimumNoticeDays ? `${type.minimumNoticeDays} days` : "None"} />
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(type.isActive)}
                aria-label={`${type.isActive ? "Deactivate" : "Activate"} ${type.name}`}
                disabled={saving}
                onClick={() => onToggleActive(type, !type.isActive)}
                className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${type.isActive ? "bg-violet-700" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${type.isActive ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </article>
          ))}
          {!types.length && <p className="px-2 py-8 text-center text-[11px] text-slate-400">No leave types configured yet.</p>}
        </div>
        <button type="button" onClick={onAdd} className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 text-[11px] font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-50">
          <Plus size={14} /> Add leave type
        </button>
        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-semibold text-slate-900">Approval flow</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <FlowStep number="1" title="Employee submits" text="Preview shows working days." />
            <FlowStep number="2" title="Administrator reviews" text="Approve or reject with a note." />
            <FlowStep number="3" title="Records update" text="Balance, calendar, and attendance." />
          </div>
        </div>
        <div className="mt-auto flex justify-end gap-2 border-t border-slate-100 pt-4 sm:pt-8">
          <button type="button" onClick={onDiscard} className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Discard</button>
          <button type="button" onClick={onSave} disabled={saving} className="h-9 rounded-xl bg-gradient-to-r from-[#7116b9] to-[#853de8] px-4 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(124,58,237,.22)] disabled:opacity-50">{saving ? "Saving..." : "Save policy"}</button>
        </div>
      </section>
      <aside className="grid content-start gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.03)]">
          <div className="flex items-center justify-between"><h2 className="text-[13px] font-semibold text-slate-900">Working-day rules</h2><span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700">Read-only</span></div>
          <p className="mt-3 text-[10px] text-slate-500">Weekends</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {weekendDays.map((weekday) => <span key={weekday} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">{weekdays[weekday].slice(0, 3)}</span>)}
          </div>
          <p className="mb-1.5 mt-3 text-[10px] text-slate-500">Next public holidays</p>
          <div className="flex flex-wrap gap-1.5">
            {upcomingHolidays.length ? upcomingHolidays.map((holiday) => (
              <span key={holiday._id || holiday.date} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[9px] font-semibold text-amber-700">{formatDate(holiday.date, { day: "numeric", month: "short" })}{holiday.to && holiday.to !== holiday.date ? `–${formatDate(holiday.to, { day: "numeric", month: "short" })}` : ""} · {holiday.name}</span>
            )) : <span className="text-[10px] text-slate-400">No upcoming holidays scheduled.</span>}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-400">Set in Office settings and Calendar. These days are excluded from leave calculations.</p>
        </section>
        <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.03)]">
          <h2 className="text-[13px] font-semibold text-slate-900">Request rules</h2>
          <div className="mt-2">
            {policyToggle("allowHalfDay", "Allow half-day requests", "Employees can request a 0.5 day.")}
            {policyToggle("requireReason", "Require a reason", "A reason is mandatory for every request.")}
            {policyToggle("allowPastDatedRequests", "Allow past-dated requests", `Allow requests up to ${policy.pastDatedLimitDays} days after leave.`)}
            {policy.allowPastDatedRequests && <Field label="Past-dated limit (days)" className="mt-3"><input type="number" min="1" max="30" value={policy.pastDatedLimitDays} onChange={(event) => setPolicy({ ...policy, pastDatedLimitDays: Number(event.target.value) })} /></Field>}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3">
              <div><p className="text-[11px] font-semibold text-slate-800">Leave year</p><p className="mt-0.5 text-[9px] text-slate-500">Balances reset on this date.</p></div>
              <label className="min-w-24">
                <span className="sr-only">Leave year starts on month and day</span>
                <input type="text" value={policy.leaveYearStart} onChange={(event) => setPolicy({ ...policy, leaveYearStart: event.target.value })} placeholder="MM-DD" pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])" className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-[10px] font-semibold text-slate-700 outline-none focus:border-violet-400" aria-label={`Leave year range: ${resetLabel}`} />
              </label>
            </div>
            <p className="mt-1 text-right text-[9px] text-slate-400">Current reset cycle: {resetLabel}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function PolicyMetric({ label, value }) {
  return <div><p className="text-[8px] font-medium text-slate-500 sm:hidden">{label}</p><p className="mt-0.5 text-[9px] font-medium text-slate-700 sm:text-[10px]">{value}</p></div>;
}

function FlowStep({ number, title, text }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-[#FBFAFF] p-2.5">
      <span className="mb-1.5 grid size-5 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-[9px] font-bold text-white">{number}</span>
      <p className="text-[9px] font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-[9px] leading-4 text-slate-500">{text}</p>
    </div>
  );
}

