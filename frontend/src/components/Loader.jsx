import BrandLogo from "./BrandLogo";

export default function Loader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#F3E8FF_0%,#F8FAFC_48%,#EDE9FE_100%)] px-5 font-['Inter',sans-serif] text-slate-800">
      <div className="flex flex-col items-center">
        <div className="relative grid size-24 place-items-center sm:size-28" role="status" aria-label="Loading Crew HRCore">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
          <span className="absolute inset-2 animate-[spin_2.8s_linear_infinite_reverse] rounded-full border border-purple-200 border-b-purple-500" />
          <span className="grid size-[68px] place-items-center rounded-2xl p-2  sm:size-[78px]">
            <BrandLogo alt="" />
          </span>
        </div>
        <p className="mt-5 font-['Poppins',sans-serif] text-[15px] font-semibold tracking-[-0.2px] text-slate-900">Preparing your workspace</p>
        <p className="mt-1 text-[13px] text-slate-500">Crew HRCore is loading securely.</p>
      </div>
    </div>
  );
}
