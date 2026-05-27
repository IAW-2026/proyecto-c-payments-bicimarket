import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

export { metadata } from "@/app/layout"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.userId) {
    redirect("/sign-in")
  }

  const claims = session?.sessionClaims as Record<string, unknown> | undefined
  const publicMetadata = claims?.publicMetadata as Record<string, unknown> | undefined
  const isAdmin = publicMetadata?.admin === true

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 16px",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Acceso denegado</h1>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 380 }}>
          No tenés permisos de administrador en esta aplicación.
        </p>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 380, marginTop: 8, fontSize: 13 }}>
          Esta aplicación requiere <strong>publicMetadata.admin = true</strong> en tu cuenta de Clerk-Payments.
          Si creés que esto es un error, contactá al administrador del sistema.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
