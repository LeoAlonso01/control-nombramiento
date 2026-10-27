import type { ReactNode } from "react";
import { ProtectedWorkspace } from "@/app/protected-workspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <ProtectedWorkspace>{children}</ProtectedWorkspace>;
}
