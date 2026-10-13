"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canSubmitCredentials,
  createLoginRequest,
  isLoginSuccessful,
  LOGIN_ENDPOINT,
  loginFailureMessage,
} from "@/app/login/login-contract";

type LoginResponse = {
  success?: unknown;
  error?: unknown;
};

export function LoginForm() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const normalizedIdentity = identity.trim();

    if (!normalizedIdentity || !password || normalizedIdentity.length > 255 || password.length > 1024) {
      setErrorMessage("Ingresa tu correo o nombre de usuario y tu contraseña.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        LOGIN_ENDPOINT,
        createLoginRequest(normalizedIdentity, password),
      );

      let payload: LoginResponse | null = null;
      try {
        payload = (await response.json()) as LoginResponse;
      } catch {
        payload = null;
      }

      if (!isLoginSuccessful(response.ok, payload)) {
        setPassword("");
        setErrorMessage(loginFailureMessage(response.status));
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setPassword("");
      setErrorMessage("No se pudo conectar con el servicio de autenticación. Intenta de nuevo.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-busy={isSubmitting}>
      <div className="space-y-2">
        <label htmlFor="login-identity" className="block text-sm font-medium text-slate-800">
          Correo electrónico o nombre de usuario
        </label>
        <input
          id="login-identity"
          name="identity"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={255}
          required
          disabled={isSubmitting}
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#a82732] focus:ring-2 focus:ring-[#a82732]/15 disabled:bg-slate-50 sm:text-sm"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "login-error" : undefined}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="block text-sm font-medium text-slate-800">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            maxLength={1024}
            required
            disabled={isSubmitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#a82732] focus:ring-2 focus:ring-[#a82732]/15 disabled:bg-slate-50 sm:text-sm"
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            disabled={isSubmitting}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a82732] disabled:opacity-50"
          >
            {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p id="login-error" role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={!canSubmitCredentials(identity, password, isSubmitting)}
        className="h-11 w-full rounded-md bg-[#a82732] px-4 text-sm font-semibold text-white hover:bg-[#8e202a] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
      >
        {isSubmitting ? (
          <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Verificando acceso…</>
        ) : (
          <><LockKeyhole aria-hidden="true" className="size-4" /> Iniciar sesión</>
        )}
      </Button>
    </form>
  );
}
