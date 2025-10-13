'use client'
import ProtectedRoute from './ProtectedRoute'
import Navbar from './Navbar'

export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}