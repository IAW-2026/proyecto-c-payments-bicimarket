"use client"

import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { useState, useEffect, useCallback } from "react"

import { Icons, Glyph } from "@/lib/icons"
import { ThemeToggle } from "@/components/admin/theme-toggle"
import type { ReactNode } from "react"

// Module-level state — persists across AdminShell mount/unmount on page navigation
let _sidebarOpen = false
let _firstVisit = true

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: Icons.Home },
  { key: "payments", label: "Pagos", href: "/admin/payments", icon: Icons.CreditCard },
  { key: "settlements", label: "Liquidaciones", href: "/admin/settlements", icon: Icons.Coins },
  { key: "refunds", label: "Reembolsos", href: "/admin/refunds", icon: Icons.Undo },
  { key: "payouts", label: "Pagos a vendedores", href: "/admin/payouts", icon: Icons.Send },
  { key: "receipts", label: "Comprobantes", href: "/admin/receipts", icon: Icons.Receipt },
]

function Sidebar({ active, open, onClose }: { active: string; open: boolean; onClose: () => void }) {
  return (
    <>
      <div className={`sidebar-overlay${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-glyph"><Glyph /></div>
          <div>
            <div className="brand-name">BiciMarket</div>
            <div className="brand-sub">Payments</div>
          </div>
        </div>
        <div className="nav">
          <div className="nav-section">General</div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`nav-item ${active === item.key ? "active" : ""}`}
                onClick={() => { if (matchMedia('(max-width: 767px)').matches) onClose() }}
              >
                <span className="nav-icon"><Icon /></span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
        <div className="sidebar-foot">
          <UserButton
            appearance={{
              elements: {
                rootBox: { width: "100%" },
                userButtonBox: {
                  flexDirection: "row",
                  width: "100%",
                  gap: "10px",
                  padding: "4px",
                },
                userButtonOuterIdentifier: {
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--sidebar-foreground)",
                },
                userButtonTrigger: {
                  width: "100%",
                  borderRadius: "8px",
                  "&:hover": { background: "var(--sidebar-accent)" },
                },
              },
            }}
            showName
          />
        </div>
      </aside>
    </>
  )
}

function Topbar({ crumbs, onMenuClick, sidebarOpen }: { crumbs: string[]; onMenuClick: () => void; sidebarOpen: boolean }) {
  return (
    <div className="topbar">
      <button className={`hamburger icon-btn${sidebarOpen ? " is-active" : ""}`} onClick={onMenuClick} aria-label={sidebarOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}>
        <span className="hamburger-icon">{sidebarOpen ? <Icons.Close /> : <Icons.Menu />}</span>
      </button>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i}>
            <span className={i === crumbs.length - 1 ? "last" : ""}>{c}</span>
            {i < crumbs.length - 1 && <span className="sep"><Icons.Chevron size={12} /></span>}
          </span>
        ))}
      </div>
      <div className="topbar-spacer" />
      <ThemeToggle />
      <UserButton />
    </div>
  )
}

export function AdminShell({
  active = "dashboard",
  crumbs,
  children,
}: {
  active?: string
  crumbs?: string[]
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(_firstVisit ? false : _sidebarOpen)

  const defaultCrumbs = crumbs ?? ["Admin", (navItems.find((n) => n.key === active)?.label ?? "Dashboard")]

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Persist sidebar state across page navigation
  useEffect(() => { _sidebarOpen = sidebarOpen }, [sidebarOpen])

  // On first visit, open sidebar by default on desktop
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (_firstVisit) {
      _firstVisit = false
      if (matchMedia('(min-width: 768px)').matches) setTimeout(() => setSidebarOpen(true))
    }
  }, [])

  return (
    <div className={`app${!sidebarOpen ? " sidebar-collapsed" : ""}`}>
      <Sidebar active={active} open={sidebarOpen} onClose={closeSidebar} />
      <div className="main">
        <Topbar crumbs={defaultCrumbs} onMenuClick={() => setSidebarOpen((c) => !c)} sidebarOpen={sidebarOpen} />
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
