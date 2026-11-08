import { noStoreJson, clearPocketBaseAuthCookie } from "@/lib/auth/http";

/** Invalida la cookie de sesión del navegador. */
export async function POST() {
  const response = noStoreJson({ success: true });
  response.headers.append("Set-Cookie", clearPocketBaseAuthCookie());
  return response;
}
