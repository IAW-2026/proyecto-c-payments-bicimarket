"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"

import { Icons, Glyph } from "@/lib/icons"
import type { ReactNode } from "react"

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: Icons.Home },
  { key: "payments", label: "Payments", href: "/admin/payments", icon: Icons.CreditCard },
  { key: "settlements", label: "Settlements", href: "/admin/settlements", icon: Icons.Coins },
  { key: "refunds", label: "Refunds", href: "/admin/refunds", icon: Icons.Undo },
  { key: "payouts", label: "Payouts", href: "/admin/payouts", icon: Icons.Send },
  { key: "receipts", label: "Receipts", href: "/admin/receipts", icon: Icons.Receipt },
]

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-glyph"><Glyph /></div>
        <div>
          <div className="brand-name">BiciMarket</div>
          <div className="brand-sub mono">payments · v1.4</div>
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
                flexDirection: "row-reverse",
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
  )
}

function Topbar({ crumbs }: { crumbs: string[] }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i}>
            <span className={i === crumbs.length - 1 ? "last" : ""}>{c}</span>
            {i < crumbs.length - 1 && <span className="sep"><Icons.Chevron size={12} /></span>}
          </span>
        ))}
      </div>
      <div className="topbar-spacer" />
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
  const pathname = usePathname()
  const defaultCrumbs = crumbs ?? ["Admin", (navItems.find((n) => n.key === active)?.label ?? "Dashboard")]

  return (
    <div className="app" style={{ minHeight: "100dvh" }}>
      <Sidebar active={active} />
      <div className="main">
        <Topbar crumbs={defaultCrumbs} />
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
