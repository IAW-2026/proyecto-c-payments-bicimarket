import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { AutoSignOut } from "@/components/admin/auto-sign-out"

export { metadata } from "@/app/layout"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.userId) {
    redirect("/sign-in")
  }

  const user = await currentUser()
  const isAdmin = user?.publicMetadata?.admin === true

  if (!isAdmin) {
    return (
      <>
        <AutoSignOut />
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
            No tenés permisos de administrador en esta aplicación. Cerrando sesión...
          </p>
        </div>
      </>
    )
  }

  return <>{children}</>
}
