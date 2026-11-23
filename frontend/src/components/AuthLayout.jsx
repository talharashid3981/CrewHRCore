import { CalendarCheck, Clock3 } from "lucide-react";
import BrandLogo from "./BrandLogo";

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
  variant = "default",
}) {
  const loginStyle = variant === "login";
  const BrandHeading = loginStyle ? "p" : "h2";

  return (
    <main
      className={`grid ${
        loginStyle ? "min-h-[100dvh]" : "min-h-screen"
      } w-full place-items-center bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] px-3 py-5 font-['Inter',sans-serif] sm:px-6 sm:py-8 ${
        loginStyle ? "lg:px-8 lg:py-5" : "lg:px-8 lg:py-6"
      }`}
    >
      <section
        className={`grid w-full grid-cols-1 overflow-hidden bg-white shadow-[0_40px_90px_rgba(106,13,173,0.18),0_6px_20px_rgba(15,23,42,0.06)] ${
          loginStyle
            ? "max-w-[560px] rounded-lg lg:min-h-[max(640px,calc(100dvh_-_2.5rem))] lg:max-w-[1200px] lg:grid-cols-2"
            : "max-w-[1200px] rounded-[30px] md:min-h-[620px] md:grid-cols-2 lg:min-h-[700px]"
        }`}
      >
        <aside
          className={`relative flex flex-col overflow-hidden bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] text-white ${
            loginStyle
              ? "min-h-[230px] px-6 pb-20 pt-6 sm:px-10 lg:min-h-0 lg:px-10 lg:py-9 xl:px-12"
              : "min-h-[205px] px-6 py-6 sm:px-10 md:min-h-0 md:px-10 md:py-10 xl:px-12 xl:py-12"
          }`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[280px] -right-[260px] h-[700px] w-[700px] rounded-full border border-white/15"
          >
            <div className="absolute inset-[90px] rounded-full border border-white/15" />
            <div className="absolute inset-[180px] rounded-full border border-white/15" />
            <div className="absolute inset-[265px] rounded-full border border-white/15" />
          </div>

          <div
            className={`relative flex items-center ${
              loginStyle ? "gap-[14px]" : "gap-3.5"
            }`}
          >
            <span
              className={`grid shrink-0 place-items-center  text-white  ${
                loginStyle
                  ? "h-10 w-10 rounded-lg lg:h-[50px] lg:w-[50px]"
                  : "size-11 rounded-xl sm:size-[50px]"
              }`}
            >
              <BrandLogo alt="" />
            </span>
            <span
              className={`font-['Poppins',sans-serif] text-xl font-semibold tracking-tight ${
                loginStyle ? "lg:text-2xl" : "sm:text-2xl"
              }`}
            >
              Crew HRCore
            </span>
          </div>

          <div
            className={`relative max-w-[440px] ${
              loginStyle ? "mt-8 lg:mt-10" : "mt-7 md:mt-16"
            }`}
          >
            {!loginStyle && (
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-purple-200 sm:text-[11px]">
                Your team workspace
              </p>
            )}
            <BrandHeading
              className={`font-['Poppins',sans-serif] font-semibold ${
                loginStyle
                  ? "text-[24px] leading-[1.2] tracking-[-0.6px] sm:text-[26px] lg:text-[34px] lg:leading-[1.16] lg:tracking-[-0.8px] xl:text-[40px]"
                  : "text-[26px] leading-[1.16] tracking-[-.7px] sm:text-[32px] lg:text-[38px]"
              }`}
            >
              {loginStyle ? (
                <>
                  Your account,
                  <br />
                  securely restored.
                </>
              ) : (
                <>
                  People first.
                  <br />
                  Work smarter.
                </>
              )}
            </BrandHeading>
            <p
              className={`${
                loginStyle
                  ? "mt-4 hidden max-w-[410px] text-[15px] leading-[1.65] text-purple-100 sm:text-[16px] lg:block"
                  : "mt-3 max-w-[390px] text-[13px] leading-6 text-purple-100 sm:text-[15px] sm:leading-[1.65]"
              }`}
            >
              {loginStyle
                ? "Follow a few simple steps to get back into your Crew HRCore workspace."
                : "A clearer way to manage your workday and stay connected with your team."}
            </p>
          </div>

          <ul
            className={`relative mt-auto hidden pt-10 ${
              loginStyle
                ? "divide-y divide-purple-100 rounded-lg bg-white/[0.96] px-5 py-4 text-slate-900 shadow-xl shadow-purple-950/10 sm:px-6 sm:py-5 lg:block lg:pt-6"
                : "space-y-3 md:block"
            }`}
          >
            {highlights.map(
              (
                { icon: Icon, title: itemTitle, description: itemDescription },
                index,
              ) => (
                <li
                  className={`flex items-center gap-3 ${
                    loginStyle
                      ? "py-3 first:pt-0 last:pb-0 sm:gap-4"
                      : "rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm"
                  }`}
                  key={itemTitle}
                >
                  <span
                    className={`grid shrink-0 place-items-center ${
                      loginStyle
                        ? `h-[34px] w-[34px] rounded-full font-['Poppins',sans-serif] text-sm font-semibold ${
                            index === 0
                              ? "bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-md shadow-violet-300"
                              : "bg-purple-100 text-violet-800"
                          }`
                        : "size-9 rounded-lg bg-white/15 text-purple-100"
                    }`}
                  >
                    {loginStyle ? index + 1 : <Icon size={17} />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block ${
                        loginStyle
                          ? "text-[14px] font-semibold leading-5 text-slate-900"
                          : "text-[13px] font-semibold text-white"
                      }`}
                    >
                      {itemTitle}
                    </span>
                    <span
                      className={`mt-0.5 block ${
                        loginStyle
                          ? "text-[12px] leading-[1.4] text-slate-500 sm:text-[13px]"
                          : "text-[11px] leading-4 text-purple-100/85"
                      }`}
                    >
                      {itemDescription}
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </aside>

        <div
          className={`relative z-10 flex min-w-0 items-center justify-center bg-white px-5 sm:px-10 ${
            loginStyle
              ? "-mt-5 rounded-t-lg pb-8 pt-0 sm:pb-10 lg:mt-0 lg:rounded-none lg:px-10 lg:py-10 xl:px-14"
              : "-mt-7 rounded-t-[28px] pb-8 pt-8 md:mt-0 md:rounded-none md:px-10 md:py-12 xl:px-14"
          }`}
        >
          <div className="w-full min-w-0 max-w-[400px]">
            <div
              className={`mb-5 text-center ${
                loginStyle ? "lg:mb-6" : "md:mb-7"
              }`}
            >
              <div
                className={`mx-auto grid place-items-center rounded-full bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet-800 shadow-[0_8px_24px_rgba(106,13,173,0.12)] ${
                  loginStyle
                    ? "relative -mt-[42px] mb-4 h-[84px] w-[84px] lg:mt-0 lg:mb-3 lg:h-[72px] lg:w-[72px] lg:shadow-none"
                    : "mb-3 size-[68px] md:size-[76px]"
                }`}
              >
                {icon}
              </div>
              <h1
                className={`font-['Poppins',sans-serif] font-semibold leading-tight text-slate-900 ${
                  loginStyle
                    ? "text-[30px] tracking-[-0.6px] lg:mt-2 lg:text-[28px] xl:text-[30px]"
                    : "text-[27px] tracking-[-.6px] sm:text-[30px]"
                }`}
              >
                {title}
              </h1>
              <p
                className={`mx-auto mt-2 max-w-[360px] text-slate-600 ${
                  loginStyle
                    ? "text-[14px] leading-[1.5] sm:text-[15px] lg:mt-1.5 lg:leading-6"
                    : "text-[13px] leading-5 sm:text-[15px] sm:leading-6"
                }`}
              >
                {description}
              </p>
            </div>
            {children}
            {footer && (
              <footer
                className={
                  loginStyle
                    ? "mt-5 text-center text-[13px] text-slate-600"
                    : "mt-6 border-t border-slate-100 pt-5 text-center text-[13px] text-slate-500 sm:mt-7"
                }
              >
                {loginStyle && (
                  <div className="mb-5 flex items-center gap-3 text-slate-500">
                    <span className="h-px flex-1 bg-slate-200" />
                    <span>Or</span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
                {footer}
              </footer>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
