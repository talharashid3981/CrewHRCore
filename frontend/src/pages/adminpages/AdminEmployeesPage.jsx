import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  UserCheck,
  UserRoundX,
  X,
} from "lucide-react";
import {
  approveEmployee,
  exportEmployees,
  getEmployeeMonthlyReport,
  getEmployeeSummary,
  inviteEmployee,
  listEmployees,
  rejectEmployee,
  remindEmployee,
  setEmployeeStatus,
  updateEmployee,
} from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";
import useToastMessage from "../../hooks/useToastMessage";

const emptySummary = { total: 0, incomplete: 0, pending: 0, approved: 0, rejected: 0, active: 0, inactive: 0 };
const statusItems = [
  { label: "Total", key: "", countKey: "total" },
  { label: "Incomplete", key: "incomplete", countKey: "incomplete" },
  { label: "Pending review", key: "pending", countKey: "pending" },
  { label: "Approved", key: "approved", countKey: "approved" },
  { label: "Rejected", key: "rejected", countKey: "rejected" },
];
const statusStyle = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  incomplete: "border-slate-200 bg-slate-100 text-slate-600",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};
const pageSize = 8;
const fieldClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100";
const iconButtonClass = "grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40";

export default function AdminEmployeesPage({ embedded = false, initialStatus = "" }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(emptySummary);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState(initialStatus);
  const [account, setAccount] = useState("");
  const [department, setDepartment] = useState("");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [viewingNote, setViewingNote] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });
  const requestId = useRef(0);

  const loadEmployees = useCallback(async () => {
    const requestIdForLoad = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [summaryData, employeeData] = await Promise.all([
        getEmployeeSummary(),
        listEmployees({
          status: status || undefined,
          account: account || undefined,
          department: department || undefined,
          search: searchFilter || undefined,
          sort,
          page,
          limit: pageSize,
        }),
      ]);
      if (requestIdForLoad !== requestId.current) return;
      setSummary({ ...emptySummary, ...(summaryData.summary || {}) });
      setDepartments(summaryData.departments || []);
      setEmployees(employeeData.users || []);
      setPagination(employeeData.pagination || { page: 1, pages: 1, total: 0 });
    } catch (requestError) {
      if (requestIdForLoad === requestId.current) {
        setError(requestError.response?.data?.message || "Unable to load employees.");
      }
    } finally {
      if (requestIdForLoad === requestId.current) setLoading(false);
    }
  }, [account, department, page, searchFilter, sort, status]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadEmployees(); }, 0);
    return () => clearTimeout(timer);
  }, [loadEmployees]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearchFilter(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest?.("[data-employee-actions]")) setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenuId]);

  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const setStatusFilter = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };
  const setFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const runAction = async (request, successMessage) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await request();
      setNotice(result?.message || successMessage);
      setOpenMenuId(null);
      await loadEmployees();
      return true;
    } catch (requestError) {
      const message = requestError.response?.data?.message || "The action could not be completed.";
      if (requestError.response?.data?.user) await loadEmployees();
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fields = {
      name: formData.get("name"),
      department: formData.get("department"),
      designation: formData.get("designation"),
      shift: formData.get("shift"),
      shiftStart: formData.get("shiftStart"),
      shiftEnd: formData.get("shiftEnd"),
      joiningDate: formData.get("joiningDate") || undefined,
    };
    const succeeded = await runAction(
      () => updateEmployee(editing.id, fields),
      "Employee details updated.",
    );
    if (succeeded) setEditing(null);
  };

  const approve = async () => {
    const employee = reviewing;
    const succeeded = await runAction(
      () => approveEmployee(employee.id),
      `${employee.name} approved successfully.`,
    );
    if (succeeded) setReviewing(null);
  };

  const reject = async () => {
    if (!rejectNote.trim()) return;
    const employee = reviewing;
    const succeeded = await runAction(
      () => rejectEmployee(employee.id, rejectNote.trim()),
      `${employee.name} was sent back for changes.`,
    );
    if (succeeded) {
      setReviewing(null);
      setRejectNote("");
    }
  };

  const changeAccountStatus = (employee) => runAction(
    () => setEmployeeStatus(employee.id, !employee.isActive),
    `${employee.name} is now ${employee.isActive ? "inactive" : "active"}.`,
  );

  const sendReminder = (employee) => runAction(
    () => remindEmployee(employee.id),
    `Invitation reminder sent to ${employee.email}.`,
  );

  const sendInvite = async (event) => {
    event.preventDefault();
    setInviteSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await inviteEmployee({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
      });
      setNotice(result.message || "Employee invitation sent.");
      setInviteForm({ name: "", email: "" });
      setInviteOpen(false);
      setOpenMenuId(null);
      await loadEmployees();
      return true;
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Unable to invite this employee.";
      if (requestError.response?.data?.user) await loadEmployees();
      setError(message);
      return false;
    } finally {
      setInviteSaving(false);
    }
  };

  const exportList = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await exportEmployees({
        status: status || undefined,
        account: account || undefined,
        department: department || undefined,
        search: searchFilter || undefined,
        sort,
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "crewhr-employees.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export employees.");
    } finally {
      setExporting(false);
    }
  };

  const viewAttendance = async (employee) => {
    setOpenMenuId(null);
    setAttendanceLoading(true);
    setError("");
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date());
      const month = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
      const result = await getEmployeeMonthlyReport(employee.id, { month });
      setAttendance({ employee, ...result });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load employee attendance.");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const start = pagination.total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, pagination.total);

  return <main className={embedded ? "w-full font-['Inter',sans-serif] text-slate-800" : "min-h-screen bg-[#F8FAFC] px-4 py-8 font-['Inter',sans-serif] text-slate-800 sm:px-8 lg:px-12"}>
    <header className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-.5px] text-slate-900">Employees</h1>
        <p className="mt-1 text-[12px] text-slate-500">Review onboarding, search people and manage accounts.</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-violet-200 hover:text-violet-700 disabled:opacity-60" onClick={exportList} disabled={exporting}>
          <Download size={14} className="text-violet-600" />{exporting ? "Exporting..." : "Export"}
        </button>
        <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7116b9] to-[#853de8] px-3.5 text-[11px] font-semibold text-white shadow-[0_5px_12px_rgba(112,22,185,.22)] hover:brightness-105" onClick={() => { setError(""); setNotice(""); setInviteOpen(true); }}>
          <Plus size={15} />Invite employee
        </button>
      </div>
    </header>

    <section className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by onboarding status">
      {statusItems.map((item) => {
        const active = status === item.key;
        return <button
          key={item.label}
          className={`inline-flex h-[38px] shrink-0 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${active ? "border-violet-700 bg-gradient-to-r from-[#7315bd] to-[#8439ec] text-white shadow-[0_5px_12px_rgba(112,22,185,.2)]" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"}`}
          onClick={() => setStatusFilter(item.key)}
          aria-pressed={active}
        >
          {item.label}
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
            {loading && !summary.total ? "—" : numberFormat(item.countKey ? summary[item.countKey] : 0)}
          </span>
        </button>;
      })}
    </section>

    <section className="mb-3 grid gap-2 sm:grid-cols-[minmax(190px,1fr)_auto_auto_minmax(150px,auto)]">
      <label className="flex h-[38px] min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-violet-600 shadow-sm focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100">
        <Search size={15} className="shrink-0" />
        <input
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-800 outline-none placeholder:text-slate-400"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email or department"
          aria-label="Search employees"
        />
        {search && <button className="grid size-5 place-items-center text-slate-400 hover:text-slate-700" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
      </label>
      <SelectFilter label="Department" value={department} onChange={setFilter(setDepartment)}>
        <option value="">All departments</option>
        {departments.map((item) => <option key={item} value={item}>{item}</option>)}
      </SelectFilter>
      <SelectFilter label="Account" value={account} onChange={setFilter(setAccount)}>
        <option value="">All accounts</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </SelectFilter>
      <SelectFilter label="Sort" value={sort} onChange={setFilter(setSort)} className="sm:justify-self-end">
        <option value="recent">Recently updated</option>
        <option value="name">Name A–Z</option>
        <option value="joiningDate">Joining date</option>
        <option value="status">Onboarding status</option>
      </SelectFilter>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_5px_18px_rgba(15,23,42,.045)]">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[970px] border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-100 text-[10px] font-semibold text-slate-500">
              {["Employee", "Department and shift", "Job title", "Joining date", "Onboarding", "Account", "Actions"].map((heading) => <th className="whitespace-nowrap px-3 first:pl-4 last:pr-4" key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <TableMessage>Loading employees...</TableMessage> : employees.length === 0 ? <TableMessage>No employees match these filters. Try changing your search or filters.</TableMessage> : employees.map((employee) => <EmployeeTableRow
              employee={employee}
              key={employee.id}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onReview={() => { setReviewing(employee); setRejectNote(""); }}
              onEdit={() => { setEditing(employee); setOpenMenuId(null); }}
              onViewAttendance={() => viewAttendance(employee)}
              onViewNote={() => { setViewingNote(employee); setOpenMenuId(null); }}
              onReminder={() => sendReminder(employee)}
              onToggleAccount={() => changeAccountStatus(employee)}
              saving={saving}
            />)}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 lg:hidden">
        {loading ? <div className="grid min-h-40 place-items-center text-xs text-slate-400">Loading employees...</div> : employees.length === 0 ? <div className="grid min-h-40 place-items-center px-5 text-center text-xs text-slate-400">No employees match these filters. Try changing your search or filters.</div> : employees.map((employee) => <EmployeeMobileCard
          employee={employee}
          key={employee.id}
          onReview={() => { setReviewing(employee); setRejectNote(""); }}
          onEdit={() => setEditing(employee)}
          onViewAttendance={() => viewAttendance(employee)}
          onViewNote={() => setViewingNote(employee)}
          onReminder={() => sendReminder(employee)}
          onToggleAccount={() => changeAccountStatus(employee)}
          saving={saving}
        />)}
      </div>

      <footer className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center">
        <span>Showing {start}–{end} of {numberFormat(pagination.total)} employees</span>
        <Pagination page={page} pages={pagination.pages || 1} onChange={setPage} />
      </footer>
    </section>

    {inviteOpen && <Modal title="Invite employee" subtitle="Send a secure account setup link to a new employee." onClose={() => setInviteOpen(false)}>
      <form className="grid gap-3" onSubmit={sendInvite}>
        <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">Full name
          <input className={fieldClass} autoFocus minLength={2} maxLength={100} value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} required />
        </label>
        <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">Work email
          <input className={fieldClass} type="email" autoComplete="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} required />
        </label>
        <p className="text-[10px] leading-5 text-slate-500">The employee will set a password, then complete onboarding with their department, job title, shift and joining date.</p>
        <div className="mt-1 flex justify-end gap-2">
          <SecondaryButton onClick={() => setInviteOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton disabled={inviteSaving} icon={Send}>{inviteSaving ? "Sending..." : "Send invitation"}</PrimaryButton>
        </div>
      </form>
    </Modal>}

    {editing && <Modal title="Edit employee details" subtitle={`Update the profile for ${editing.name}.`} onClose={() => setEditing(null)}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveEdit}>
        <Field label="Full name"><input className={fieldClass} name="name" defaultValue={editing.name} required minLength={2} maxLength={100} /></Field>
        <Field label="Email"><input className={`${fieldClass} bg-slate-50 text-slate-500`} value={editing.email} readOnly /></Field>
        <Field label="Department"><input className={fieldClass} name="department" defaultValue={editing.department || ""} required maxLength={100} /></Field>
        <Field label="Job title"><input className={fieldClass} name="designation" defaultValue={editing.designation || ""} maxLength={100} /></Field>
        <Field label="Shift">
          <select className={fieldClass} name="shift" defaultValue={editing.shift || "AM"}>
            <option value="AM">AM</option><option value="PM">PM</option>
          </select>
        </Field>
        <Field label="Joining date"><input className={fieldClass} name="joiningDate" type="date" defaultValue={dateValue(editing.joiningDate)} /></Field>
        <Field label="Shift starts"><input className={fieldClass} name="shiftStart" type="time" defaultValue={editing.shiftStart || (editing.shift === "PM" ? "11:00" : "09:00")} /></Field>
        <Field label="Shift ends"><input className={fieldClass} name="shiftEnd" type="time" defaultValue={editing.shiftEnd || (editing.shift === "PM" ? "20:00" : "18:00")} /></Field>
        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <SecondaryButton onClick={() => setEditing(null)}>Cancel</SecondaryButton>
          <PrimaryButton disabled={saving} icon={Check}>{saving ? "Saving..." : "Save changes"}</PrimaryButton>
        </div>
      </form>
    </Modal>}

    {reviewing && <Modal title="Review onboarding" subtitle={`Review ${reviewing.name}'s employee profile.`} onClose={() => { setReviewing(null); setRejectNote(""); }}>
      <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
        <InfoValue label="Email" value={reviewing.email} />
        <InfoValue label="Department" value={reviewing.department} />
        <InfoValue label="Job title" value={reviewing.designation} />
        <InfoValue label="Shift" value={reviewing.shiftStart && reviewing.shiftEnd ? `${reviewing.shiftStart}–${reviewing.shiftEnd}` : reviewing.shift} />
        <InfoValue label="Joining date" value={formatDate(reviewing.joiningDate)} />
        <InfoValue label="Submitted" value={formatDateTime(reviewing.onboardingSubmittedAt)} />
      </div>
      <label className="mt-4 grid gap-1.5 text-[11px] font-semibold text-slate-700">Request changes
        <textarea className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Explain what needs to be corrected before resubmission" maxLength={1000} />
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={() => { setReviewing(null); setRejectNote(""); }}>Close</SecondaryButton>
        <button type="button" disabled={saving || rejectNote.trim().length < 1} onClick={() => { void reject(); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
          <UserRoundX size={14} />Request changes
        </button>
        <button type="button" disabled={saving} onClick={() => { void approve(); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-[11px] font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
          <CheckCircle2 size={14} />{saving ? "Approving..." : "Approve employee"}
        </button>
      </div>
    </Modal>}

    {viewingNote && <Modal title="Onboarding review note" subtitle={viewingNote.name} onClose={() => setViewingNote(null)}>
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
        {viewingNote.rejectionNote || "No review note was saved for this profile."}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={() => setViewingNote(null)}>Close</SecondaryButton>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-[11px] font-semibold text-white hover:bg-violet-800 disabled:opacity-50" onClick={() => { void sendReminder(viewingNote); setViewingNote(null); }} disabled={saving}>
          <Send size={14} />Send reminder
        </button>
      </div>
    </Modal>}

    {attendanceLoading && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><div className="rounded-xl bg-white px-5 py-3 text-xs text-slate-600 shadow-xl">Loading attendance...</div></div>}
    {attendance && <Modal title="Employee attendance" subtitle={`${attendance.employee.name} · ${attendance.month}`} onClose={() => setAttendance(null)} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Present", attendance.summary?.present, "text-emerald-700"],
          ["Late", attendance.summary?.late, "text-amber-700"],
          ["Absent", attendance.summary?.absent, "text-rose-700"],
          ["Attendance", `${attendance.summary?.attendancePercent ?? 0}%`, "text-violet-700"],
        ].map(([label, value, color]) => <div className="rounded-xl bg-slate-50 p-3" key={label}>
          <span className="text-[10px] text-slate-500">{label}</span>
          <strong className={`mt-1 block text-lg ${color}`}>{value ?? 0}</strong>
        </div>)}
      </div>
      <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-slate-100">
        {attendance.daily?.map((day) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-[11px] last:border-0" key={day.date}>
          <span className="text-slate-600">{formatDate(day.date)}</span>
          <span className="text-slate-500">{day.checkIn ? `In ${formatTime(day.checkIn)}` : "—"}{day.checkOut ? ` · Out ${formatTime(day.checkOut)}` : ""}</span>
          <StatusBadge status={day.status} />
        </div>)}
      </div>
    </Modal>}
  </main>;
}

function EmployeeTableRow({ employee, openMenuId, setOpenMenuId, onReview, onEdit, onViewAttendance, onViewNote, onReminder, onToggleAccount, saving }) {
  const rowMenuOpen = openMenuId === employee.id;
  return <tr className="h-[55px] border-b border-slate-100 text-[10px] last:border-0">
    <td className="whitespace-nowrap px-3 py-2 pl-4">
      <div className="flex items-center gap-2.5">
        <Avatar employee={employee} />
        <div className="min-w-0">
          <strong className="block max-w-[150px] truncate text-[11px] font-semibold text-slate-800">{employee.name}</strong>
          <span className="block max-w-[165px] truncate text-[10px] text-slate-500">{employee.email}</span>
        </div>
      </div>
    </td>
    <td className="whitespace-nowrap px-3 py-2">
      <strong className="block text-[10px] font-semibold text-slate-700">{employee.department || "Not provided"}</strong>
      <span className="mt-0.5 block text-[9px] text-slate-500">{employee.shiftStart && employee.shiftEnd ? `${employee.shiftStart}–${employee.shiftEnd}` : employee.shift || "—"}</span>
    </td>
    <td className="max-w-[120px] truncate px-3 py-2 text-[10px] text-slate-700">{employee.designation || "Not provided"}</td>
    <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-700">{formatDate(employee.joiningDate)}</td>
    <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={employee.onboardingStatus} /></td>
    <td className="whitespace-nowrap px-3 py-2"><AccountBadge isActive={employee.isActive} status={employee.onboardingStatus} /></td>
    <td className="px-3 py-2 pr-4">
      <div className="flex min-w-[68px] items-center justify-end gap-1" data-employee-actions>
        {employee.onboardingStatus === "pending" && <button className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#7116b9] to-[#853de8] px-3 text-[10px] font-semibold text-white shadow-[0_4px_10px_rgba(112,22,185,.18)] hover:brightness-105" onClick={onReview}>Review</button>}
        {employee.onboardingStatus === "incomplete" && <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:border-violet-200 hover:text-violet-700 disabled:opacity-50" onClick={onReminder} disabled={saving}><Send size={12} />Remind</button>}
        {employee.onboardingStatus === "rejected" && <button className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:border-violet-200 hover:text-violet-700" onClick={onViewNote}>View note</button>}
        {employee.onboardingStatus === "approved" && <>
          {!employee.isActive && <button className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100" onClick={onToggleAccount} disabled={saving}>Activate</button>}
          <div className="relative" data-employee-actions>
            <button className={`${iconButtonClass} ${rowMenuOpen ? "border-violet-200 bg-violet-50 text-violet-700" : ""}`} onClick={() => setOpenMenuId(rowMenuOpen ? null : employee.id)} aria-label={`More actions for ${employee.name}`} aria-expanded={rowMenuOpen}><MoreVertical size={15} /></button>
            {rowMenuOpen && <EmployeeActionMenu employee={employee} onEdit={onEdit} onViewAttendance={onViewAttendance} onToggleAccount={onToggleAccount} saving={saving} />}
          </div>
        </>}
      </div>
    </td>
  </tr>;
}

function EmployeeMobileCard({ employee, onReview, onEdit, onViewAttendance, onViewNote, onReminder, onToggleAccount, saving }) {
  return <article className="p-3.5">
    <div className="flex items-start gap-2.5">
      <Avatar employee={employee} />
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-xs font-semibold text-slate-800">{employee.name}</strong>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{employee.email}</span>
      </div>
      <StatusBadge status={employee.onboardingStatus} />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
      <InfoValue label="Department" value={employee.department} />
      <InfoValue label="Job title" value={employee.designation} />
      <InfoValue label="Shift" value={employee.shiftStart && employee.shiftEnd ? `${employee.shiftStart}–${employee.shiftEnd}` : employee.shift} />
      <InfoValue label="Joining date" value={formatDate(employee.joiningDate)} />
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
      <AccountBadge isActive={employee.isActive} status={employee.onboardingStatus} />
      <div className="flex gap-1.5">
        {employee.onboardingStatus === "pending" && <button className="h-8 rounded-lg bg-violet-700 px-3 text-[10px] font-semibold text-white" onClick={onReview}>Review</button>}
        {employee.onboardingStatus === "incomplete" && <button className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-600 disabled:opacity-50" onClick={onReminder} disabled={saving}>Send reminder</button>}
        {employee.onboardingStatus === "rejected" && <button className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-600" onClick={onViewNote}>View note</button>}
        {employee.onboardingStatus === "approved" && <>
          <button className={iconButtonClass} onClick={onEdit} aria-label="Edit employee"><Pencil size={14} /></button>
          <button className={iconButtonClass} onClick={onViewAttendance} aria-label="View attendance"><CalendarDays size={14} /></button>
          <button className={`${iconButtonClass} ${employee.isActive ? "hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" : "text-emerald-700"}`} onClick={onToggleAccount} disabled={saving} aria-label={employee.isActive ? "Deactivate account" : "Activate account"}>{employee.isActive ? <UserRoundX size={14} /> : <UserCheck size={14} />}</button>
        </>}
      </div>
    </div>
  </article>;
}

function EmployeeActionMenu({ employee, onEdit, onViewAttendance, onToggleAccount, saving }) {
  return <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,.16)]">
    <MenuButton icon={Pencil} onClick={onEdit}>Edit details</MenuButton>
    <MenuButton icon={CalendarDays} onClick={onViewAttendance}>View attendance</MenuButton>
    <div className="my-1 border-t border-slate-100" />
    <MenuButton icon={employee.isActive ? UserRoundX : UserCheck} danger={employee.isActive} disabled={saving} onClick={onToggleAccount}>
      {employee.isActive ? "Deactivate account" : "Activate account"}
    </MenuButton>
  </div>;
}

function MenuButton({ icon: Icon, children, onClick, danger = false, disabled = false }) {
  return <button onClick={onClick} disabled={disabled} className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[10px] font-medium transition disabled:opacity-50 ${danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}>
    <Icon size={13} />{children}
  </button>;
}

function Pagination({ page, pages, onChange }) {
  const pagesToShow = pageNumbers(pages, page);
  return <nav className="flex items-center gap-1" aria-label="Employee pages">
    <button className={paginationButton(false)} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
    {pagesToShow.map((item, index) => item === "ellipsis"
      ? <span className="grid size-7 place-items-center text-[10px] text-slate-400" key={`ellipsis-${index}`}>…</span>
      : <button key={item} className={paginationButton(item === page)} onClick={() => onChange(item)} aria-current={item === page ? "page" : undefined}>{item}</button>)}
    <button className={paginationButton(false)} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
  </nav>;
}

function pageNumbers(pages, page) {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const candidates = [...new Set([1, page - 1, page, page + 1, pages].filter((value) => value >= 1 && value <= pages))].sort((a, b) => a - b);
  return candidates.flatMap((value, index) => index > 0 && value - candidates[index - 1] > 1 ? ["ellipsis", value] : [value]);
}

function paginationButton(active) {
  return `grid size-7 place-items-center rounded-lg border text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-violet-700 bg-gradient-to-r from-[#7315bd] to-[#8439ec] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"}`;
}

function SelectFilter({ label, value, onChange, children, className = "" }) {
  return <label className={`relative flex h-[38px] min-w-0 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-violet-300 ${className}`}>
    <span className="mr-1.5 shrink-0 text-[10px] text-slate-500">{label}:</span>
    <select className="min-w-0 flex-1 appearance-none border-0 bg-transparent pr-4 text-[10px] font-semibold text-slate-700 outline-none" value={value} onChange={onChange} aria-label={label}>{children}</select>
    <ChevronDown size={12} className="pointer-events-none absolute right-2 text-slate-500" />
  </label>;
}

function StatusBadge({ status }) {
  return <span className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-[9px] font-semibold ${statusStyle[status] || statusStyle.incomplete}`}>
    {status === "pending" ? "Pending review" : titleCase(status || "incomplete")}
  </span>;
}

function AccountBadge({ isActive, status }) {
  if (status !== "approved") return <span className="text-[10px] text-slate-400">—</span>;
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${isActive ? "text-emerald-700" : "text-slate-500"}`}>
    <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />{isActive ? "Active" : "Inactive"}
  </span>;
}

function Avatar({ employee }) {
  const colors = ["from-violet-500 to-purple-700", "from-amber-500 to-orange-600", "from-emerald-500 to-teal-700", "from-sky-500 to-blue-700", "from-pink-500 to-rose-600"];
  const colorIndex = employee.name?.charCodeAt(0) % colors.length || 0;
  return employee.profilePic
    ? <img className="size-[32px] shrink-0 rounded-full object-cover" src={employee.profilePic} alt="" />
    : <span className={`grid size-[32px] shrink-0 place-items-center rounded-full bg-gradient-to-br ${colors[colorIndex]} text-[9px] font-bold text-white`}>
      {initials(employee.name)}
    </span>;
}

function TableMessage({ children }) {
  return <tr><td className="h-40 px-6 text-center text-xs text-slate-400" colSpan={7}>{children}</td></tr>;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`my-auto w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,.22)] sm:p-6`} role="dialog" aria-modal="true" aria-labelledby="employee-modal-title">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="employee-modal-title" className="font-['Poppins',sans-serif] text-[17px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-[11px] leading-5 text-slate-500">{subtitle}</p>}
        </div>
        <button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close"><X size={17} /></button>
      </header>
      {children}
    </section>
  </div>;
}

function Field({ label, children }) {
  return <label className="grid min-w-0 gap-1.5 text-[11px] font-semibold text-slate-700">{label}{children}</label>;
}

function InfoValue({ label, value }) {
  return <div className="min-w-0">
    <span className="block text-[9px] text-slate-500">{label}</span>
    <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-800">{value || "Not provided"}</span>
  </div>;
}

function PrimaryButton({ children, icon: Icon, disabled = false }) {
  return <button type="submit" disabled={disabled} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-[11px] font-semibold text-white transition hover:bg-violet-800 disabled:opacity-50">
    {Icon && <Icon size={14} />}{children}
  </button>;
}

function SecondaryButton({ children, onClick }) {
  return <button type="button" onClick={onClick} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{children}</button>;
}

function numberFormat(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

function initials(value = "") {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "HR";
}

function dateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+05:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Not provided";
  return `${formatDate(value)} · ${formatTime(value)}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(date);
}

function titleCase(value = "") {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
