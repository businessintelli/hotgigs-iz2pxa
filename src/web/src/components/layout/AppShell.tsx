"use client"

import * as React from "react" // ^18.0.0
import { cn } from "../../lib/utils"
import Navbar from "./Navbar"
import Sidebar from "./Sidebar"
import Footer from "./Footer"
import useMediaQuery from "../../lib/hooks/useMediaQuery"
import { UI_BREAKPOINTS, ANIMATION_DURATIONS } from "../../lib/constants"

interface AppShellProps {
  children: React.ReactNode
  className?: string
}

const AppShell: React.FC<AppShellProps> = React.memo(({ children, className }) => {
  // State for sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)
  
  // Detect viewport size for responsive behavior
  const isMobile = useMediaQuery(`(max-width: ${UI_BREAKPOINTS.TABLET - 1}px)`)
  const isTablet = useMediaQuery(
    `(min-width: ${UI_BREAKPOINTS.TABLET}px) and (max-width: ${UI_BREAKPOINTS.DESKTOP - 1}px)`
  )

  // Handle sidebar toggle with memoization
  const toggleSidebar = React.useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  // Auto-close sidebar on mobile when clicking content
  const handleContentClick = React.useCallback(() => {
    if (isMobile && isSidebarOpen) {
      setIsSidebarOpen(false)
    }
  }, [isMobile, isSidebarOpen])

  // Effect to handle responsive sidebar behavior
  React.useEffect(() => {
    setIsSidebarOpen(!isMobile)
  }, [isMobile])

  return (
    <div className="relative min-h-screen bg-background">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:top-4 focus:left-4 focus:z-50",
          "focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground",
          "focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
        )}
      >
        Skip to main content
      </a>

      {/* Navigation bar */}
      <Navbar className="fixed top-0 left-0 right-0 z-40" />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={toggleSidebar}
        className={cn(
          "transition-transform duration-200",
          !isSidebarOpen && "-translate-x-full"
        )}
      />

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          "min-h-[calc(100vh-4rem)]",
          "transition-all duration-200 ease-in-out",
          "pt-16", // Account for fixed navbar
          isSidebarOpen && !isMobile && "ml-64", // Sidebar width
          className
        )}
        onClick={handleContentClick}
        role="main"
      >
        {/* Content wrapper */}
        <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
          {children}
        </div>

        {/* Footer */}
        <Footer />
      </main>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className={cn(
            "fixed inset-0 bg-background/80 backdrop-blur-sm z-30",
            "transition-opacity duration-200",
            isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  )
})

// Display name for debugging
AppShell.displayName = "AppShell"

export default AppShell