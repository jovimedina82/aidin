'use client'

import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-gray-600 text-sm">
            © {currentYear} Surterre Properties
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6">
            <Link
              href="https://www.surterreproperties.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#3d6964] text-sm transition-colors"
            >
              www.surterreproperties.com
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-[#3d6964] text-sm transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 hover:text-[#3d6964] text-sm transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/contact"
              className="text-gray-600 hover:text-[#3d6964] text-sm transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
