import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../components/AuthProvider'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Aidin - AI-Powered Helpdesk',
  description: 'Aidin Helpdesk - Intelligent IT support ticket management system with AI-powered automation',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}