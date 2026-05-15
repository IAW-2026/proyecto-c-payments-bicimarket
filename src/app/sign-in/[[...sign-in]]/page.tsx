import { SignIn } from "@clerk/nextjs"
import { Glyph } from "@/lib/icons"

export default function SignInPage() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      minHeight: "100dvh",
      background: "var(--background)",
      color: "var(--foreground)",
    }}>
      {/* Left panel — login */}
      <div style={{ padding: "48px 56px", display: "flex", flexDirection: "column" }}>
        <div className="row gap-2" style={{ marginBottom: 64 }}>
          <div className="brand-glyph" style={{ background: "var(--primary)", color: "#fff" }}>
            <Glyph />
          </div>
          <div>
            <div className="brand-name" style={{ color: "var(--foreground)" }}>BiciMarket</div>
            <div className="brand-sub mono" style={{ color: "var(--muted-foreground)" }}>payments admin</div>
          </div>
        </div>

        <div style={{ margin: "auto 0", maxWidth: 400, width: "100%" }}>
          <h1 className="page-title" style={{ fontSize: 28 }}>Bienvenido</h1>
          <p className="page-sub" style={{ marginBottom: 32 }}>
            Acceso restringido a administradores del marketplace. Tu cuenta debe tener
            {" "}<span className="kbd">publicMetadata.admin = true</span> en Clerk-Payments.
          </p>

          <SignIn />

          <div className="alert info" style={{ marginTop: 32 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" />
            </svg>
            <div className="col">
              <span className="a-title">¿No sos admin?</span>
              <span className="a-body">Para ver tus comprobantes, ingresá a Buyer App. Para tus liquidaciones, a Seller App.</span>
            </div>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: "auto" }}>
          © 2026 BiciMarket · Payments App v1.4.0
        </div>
      </div>

      {/* Right panel — visual */}
      <div style={{
        background: "var(--sidebar)",
        color: "var(--sidebar-foreground)",
        padding: 56,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 80% 20%, oklch(0.45 0.155 168 / 60%), transparent 50%), radial-gradient(circle at 20% 80%, oklch(0.40 0.155 168 / 50%), transparent 50%)",
        }} />
        <div style={{ position: "relative", margin: "auto 0" }}>
          <span style={{ fontSize: 13, color: "oklch(0.75 0.06 168)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Operaciones del marketplace
          </span>
          <h2 style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "12px 0 24px" }}>
            Todo el dinero de BiciMarket, en un solo lugar.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "oklch(0.85 0.04 168)", maxWidth: 440 }}>
            Cobrar a compradores, liberar plata a vendedores cuando llega la bici, resolver disputas y auditar cada movimiento. Sin pisar al resto del sistema.
          </p>

          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>, t: "Cobro vía Mercado Pago", s: "Webhook firmado, retries automáticos." },
              { ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><circle cx="15" cy="15" r="6" /></svg>, t: "Liquidaciones por entrega", s: "Trigger desde Shipping, no desde pago." },
              { ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>, t: "Auditoría completa", s: "Cada call REST queda registrada." },
            ].map((f, i) => (
              <div key={i} className="row gap-3" style={{ padding: "14px 16px", background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--sidebar-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {f.ic}
                </span>
                <div className="col">
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{f.t}</span>
                  <span style={{ fontSize: 12.5, color: "oklch(0.75 0.04 168)" }}>{f.s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
