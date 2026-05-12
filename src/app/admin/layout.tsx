import { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClerkProvider, UserButton } from '@clerk/nextjs'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold">Payments Admin</h1>
              <div className="hidden md:flex gap-4">
                <Link href="/admin">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link href="/admin/payments">
                  <Button variant="ghost">Payments</Button>
                </Link>
                <Link href="/admin/settlements">
                  <Button variant="ghost">Settlements</Button>
                </Link>
              </div>
            </div>
            <UserButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
