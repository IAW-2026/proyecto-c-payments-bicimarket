export default function AdminLoading() {
  return (
    <div className="admin-shell" style={{ display: "flex", minHeight: "100dvh" }}>
      <aside className="sidebar" style={{ position: "relative", inset: 0 }}>
        <div className="brand">
          <div className="sk" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="sk" style={{ width: 90, height: 16 }} />
            <div className="sk" style={{ width: 60, height: 12 }} />
          </div>
        </div>
        <div className="nav" style={{ gap: 8 }}>
          {["Dashboard", "Pagos", "Liquidaciones", "Reembolsos", "Pagos a vendedores", "Comprobantes"].map((_, i) => (
            <div key={i} className="sk" style={{ width: "85%", height: 36, borderRadius: 8 }} />
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>
        <div className="page-layout">
          <div className="page-header">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sk" style={{ width: 160, height: 28 }} />
              <div className="sk" style={{ width: 280, height: 14 }} />
            </div>
            <div className="sk" style={{ width: 120, height: 36, borderRadius: 8 }} />
          </div>
          <div className="filterbar" style={{ marginTop: 24 }}>
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 999 }} />
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 999 }} />
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 999 }} />
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 999 }} />
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 999 }} />
          </div>
          <div className="grid-4" style={{ marginTop: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card kpi" style={{ padding: 20 }}>
                <div className="sk" style={{ width: "60%", height: 12 }} />
                <div className="sk" style={{ width: "40%", height: 28, marginTop: 14 }} />
                <div className="sk" style={{ width: "100%", height: 32, marginTop: 10 }} />
              </div>
            ))}
          </div>
          <div className="grid-2 gap-4" style={{ marginTop: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="sk" style={{ width: 140, height: 20 }} />
              <div className="sk" style={{ width: "100%", height: 200, marginTop: 16 }} />
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="sk" style={{ width: 160, height: 20 }} />
              <div className="sk" style={{ width: "100%", height: 200, marginTop: 16 }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
