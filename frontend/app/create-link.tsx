"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAppRole } from "@/app/app-shell";
import { hasPermission, type AuthorizationResource } from "@/lib/auth/authorization";

export function CreateLink({ resource, href, children }: { resource: Extract<AuthorizationResource, "nombramientos" | "declaraciones">; href: string; children: string }) {
  const role = useAppRole();
  if (!hasPermission(role ?? "auditor", resource, "create")) return null;
  return <Link href={href} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#a82732] px-4 text-sm font-medium text-white hover:bg-[#8e202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 sm:w-auto"><Plus aria-hidden="true" className="size-4" />{children}</Link>;
}
