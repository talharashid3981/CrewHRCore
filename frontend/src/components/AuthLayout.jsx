import { CalendarCheck, Clock3, UsersRound } from "lucide-react";

const highlights = [
  {
    icon: CalendarCheck,
    title: "Everything in one place",
    description: "Attendance, leave and team updates in one workspace.",
  },
  {
    icon: Clock3,
    title: "A smoother workday",
    description: "Simple tools to help your team stay on track.",
  },
];

export default function AuthLayout({
  icon,
  title,
  description,
  children,
  footer,
}) {
  return (
    <main className="grid min-h-screen w-full place-items-center bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-3 py-5 font-['Inter',sans-serif] sm:px-6 sm:py-8 lg:px-8 lg:py-6">
      <section className="grid w-full max-w-[1200px] grid-cols-1 overflow-hidden rounded-[30px] bg-white shadow-[0_40px_90px_rgba(106,13,173,0.18),0_6px_20px_rgba(15,23,42,0.06)] md:min-h-[620px] md:grid-cols-2 lg:min-h-[700px]">
        <aside className="relative flex min-h-[205px] flex-col overflow-hidden bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-6 py-6 text-white sm:px-10 md:min-h-0 md:px-10 md:py-10 xl:px-12 xl:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[280px] -right-[260px] h-[700px] w-[700px] rounded-full border border-white/15"
          >
            <div className="absolute inset-[90px] rounded-full border border-white/15" />
            <div className="absolute inset-[180px] rounded-full border border-white/15" />
            <div className="absolute inset-[265px] rounded-full border border-white/15" />
          </div>

          <div className="relative flex items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white shadow-lg shadow-purple-950/15 ring-1 ring-white/15 sm:size-[50px]">
              <UsersRound
                size={25}
                strokeWidth={1.8}
                className="sm:size-[30px]"
              />
            </span>
            <span className="font-['Poppins',sans-serif] text-xl font-semibold tracking-tight sm:text-2xl">
              Crew HRCore
            </span>
          </div>

          <div className="relative mt-7 max-w-[440px] md:mt-16">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-purple-200 sm:text-[11px]">
              Your team workspace
            </p>
            <h2 className="font-['Poppins',sans-serif] text-[26px] font-semibold leading-[1.16] tracking-[-.7px] sm:text-[32px] lg:text-[38px]">
              People first.
              <br />
              Work smarter.
            </h2>
            <p className="mt-3 max-w-[390px] text-[13px] leading-6 text-purple-100 sm:text-[15px] sm:leading-[1.65]">
              A clearer way to manage your workday and stay connected with your
              team.
            </p>
          </div>

          <ul className="relative mt-auto hidden space-y-3 pt-10 md:block">
            {highlights.map(
              ({ icon: Icon, title: itemTitle, description: itemDescription }) => (
                <li
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm"
                  key={itemTitle}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15 text-purple-100">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white">
                      {itemTitle}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-purple-100/85">
                      {itemDescription}
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </aside>

        <div className="relative z-10 -mt-7 flex min-w-0 items-center justify-center rounded-t-[28px] bg-white px-5 pb-8 pt-8 sm:px-10 md:mt-0 md:rounded-none md:px-10 md:py-12 xl:px-14">
          <div className="w-full min-w-0 max-w-[400px]">
            <div className="mb-5 text-center md:mb-7">
              <div className="mx-auto mb-3 grid size-[68px] place-items-center rounded-full bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet-800 shadow-[0_8px_24px_rgba(106,13,173,0.12)] md:size-[76px]">
                {icon}
              </div>
              <h1 className="font-['Poppins',sans-serif] text-[27px] font-semibold leading-tight tracking-[-.6px] text-slate-900 sm:text-[30px]">
                {title}
              </h1>
              <p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-5 text-slate-600 sm:text-[15px] sm:leading-6">
                {description}
              </p>
            </div>
            {children}
            {footer && (
              <footer className="mt-6 border-t border-slate-100 pt-5 text-center text-[13px] text-slate-500 sm:mt-7">
                {footer}
              </footer>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}