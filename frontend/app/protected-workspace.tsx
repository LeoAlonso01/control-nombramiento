import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { POCKETBASE_AUTH_COOKIE_NAME } from "@/lib/pocketbase/server";
import { AppShell } from "@/app/app-shell";

function SessionUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-center text-slate-800">
      <section aria-labelledby="session-error-title" className="max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 id="session-error-title" className="text-lg font-semibold">No pudimos verificar tu sesión</h1>
        <p className="mt-2 text-sm text-slate-600">El servicio de autenticación no está disponible. Intenta de nuevo más tarde.</p>
      </section>
    </main>
  );
}

async function ProtectedContent({ children }: { children: ReactNode }) {
  await connection();
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(POCKETBASE_AUTH_COOKIE_NAME);
  const authCookies = authCookie
    ? `${POCKETBASE_AUTH_COOKIE_NAME}=${authCookie.value}`
    : null;
  let session: Awaited<ReturnType<typeof getServerSession>>;
  try {
    session = await getServerSession(authCookies || null);
  } catch {
    return <SessionUnavailable />;
  }
  if (!session.authenticated) redirect("/login");

  return <AppShell role={session.user.role} user={session.user}>{children}</AppShell>;
}

export function ProtectedWorkspace({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-sm text-slate-600">Verificando sesión…</main>}>
      <ProtectedContent>{children}</ProtectedContent>
    </Suspense>
  );
}
