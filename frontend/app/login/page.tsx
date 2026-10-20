import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/app/login/login-form";

/** Presentación del acceso; la autenticación real se ejecuta en la ruta API del servidor. */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f7] px-4 py-8 text-slate-900 sm:px-6">
      <div className="w-full max-w-[440px]">
        <header className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
          <div aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-[#a82732] text-sm font-bold tracking-wide text-white shadow-sm">
            CND
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Control de</p>
            <p className="text-sm font-semibold leading-tight text-slate-900">Nombramientos</p>
            <p className="text-sm font-semibold leading-tight text-slate-900">Y Declaraciones</p>
          </div>
        </header>

        <section aria-labelledby="login-title" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-9">
          <div className="mb-7">
            <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-red-50 text-[#98232d]">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <h1 id="login-title" className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Ingresa con las credenciales de tu cuenta.
            </p>
          </div>

          <LoginForm />
        </section>

        <p className="mt-5 px-4 text-center text-xs leading-5 text-slate-500">
          Acceso para personal autorizado.
        </p>
      </div>
    </main>
  );
}
