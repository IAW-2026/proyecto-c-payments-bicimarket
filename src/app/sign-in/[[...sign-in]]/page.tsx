import { SignIn } from "@clerk/nextjs"
import { Glyph } from "@/lib/icons"

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "var(--background)",
      color: "var(--foreground)",
      padding: "24px 16px",
    }}>
      <div className="row gap-2" style={{ marginBottom: 24 }}>
        <div className="brand-glyph" style={{ background: "var(--primary)", color: "#fff" }}>
          <Glyph />
        </div>
        <div>
          <div className="brand-name" style={{ color: "var(--foreground)" }}>BiciMarket</div>
          <div className="brand-sub mono" style={{ color: "var(--muted-foreground)" }}>payments admin</div>
        </div>
      </div>

      <h1 className="page-title" style={{ fontSize: 22, textAlign: "center" }}>Acceso administrador</h1>
      <p className="page-sub" style={{ marginBottom: 24, textAlign: "center", maxWidth: 380 }}>
        Solo usuarios con permisos de administrador en Clerk-Payments.
      </p>

      <SignIn
        appearance={{
          elements: {
            footerAction: { display: "none" },
          },
        }}
      />

      <div className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        © 2026 BiciMarket · Payments App v1.4.0
      </div>
    </div>
  )
}
