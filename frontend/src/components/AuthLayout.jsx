import { Sparkles, UserRound } from "lucide-react";

export default function AuthLayout({
  icon,
  title,
  description,
  children,
  footer,
}) {
  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-violet-900/10 sm:min-h-[calc(100vh-3rem)] md:grid-cols-[.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet-900 via-violet-700 to-violet-400 p-10 text-white md:flex md:flex-col md:justify-between lg:p-14">
          <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full border border-white/20 shadow-[0_0_0_45px_rgba(255,255,255,.06),0_0_0_90px_rgba(255,255,255,.04)]" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 shadow-lg">
            <UserRound size={25} />
          </div>
          <div className="relative max-w-sm">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-violet-100">
              <Sparkles size={14} /> CrewHRCore
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
              People first.
              <br />
              <span className="text-violet-200">Work smarter.</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-violet-100/80">
              Simple, reliable attendance management for modern teams. Track,
              verify, and analyze your workforce with confidence.
            </p>
          </div>
          <p className="relative text-xs text-violet-100/70">
            Crew HRCore · Employee attendance platform
          </p>
        </aside>
        <div className="flex items-center p-6 sm:p-10 lg:p-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              {icon}
            </div>
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </header>
            {children}
            {footer && (
              <footer className="mt-7 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
                {footer}
              </footer>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
