import Link from "next/link"
import type { ReactNode } from "react"
import { auth, currentUser } from "@clerk/nextjs/server"
import { SignOutButton } from "@clerk/nextjs"

export { metadata } from "@/app/layout"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  const user = await currentUser()

  if (!session?.userId || !user) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 16px",
        textAlign: "center",
        gap: 16,
      }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Acceso denegado</h1>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 380 }}>
          Debes iniciar sesión para acceder a esta sección.
        </p>
        <Link
          href="/sign-in"
          className="btn btn-primary"
          style={{ textDecoration: "none", padding: "10px 24px", borderRadius: 8 }}
        >
          Iniciar sesión
        </Link>
      </div>
    )
  }

  // Try multiple paths for admin metadata (JWT claim or user.publicMetadata)
  const claims = session.sessionClaims as Record<string, unknown> | undefined
  const claimMetadata = claims?.publicMetadata as Record<string, unknown> | undefined
  const userMetadata = user.publicMetadata as Record<string, unknown> | undefined

  const isAdmin = claimMetadata?.admin === true || userMetadata?.admin === true

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
        gap: 16,
      }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Acceso denegado</h1>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 380 }}>
          No tenés permisos de administrador en esta aplicación.
        </p>
        <p style={{ color: "var(--muted-foreground)", maxWidth: 380, marginTop: 8, fontSize: 13 }}>
          Esta aplicación requiere <strong>publicMetadata.admin = true</strong> en tu cuenta de Clerk-Payments.
          Si creés que esto es un error, contactá al administrador del sistema.
        </p>
        <SignOutButton>
          <button className="btn btn-secondary" style={{ padding: "10px 24px", borderRadius: 8 }}>
            Cerrar sesión
          </button>
        </SignOutButton>
      </div>
    )
  }

  return <>{children}</>
}
