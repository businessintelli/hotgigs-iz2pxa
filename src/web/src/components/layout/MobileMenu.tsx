"use client"

import React, { useCallback, useEffect } from "react" // ^18.0.0
import { Menu } from "lucide-react" // ^0.284.0
import { Button } from "../ui/button"
import { useAuth } from "../../lib/hooks/useAuth"
import { cn } from "../../lib/utils"
import { UserRole } from "../../types/auth"

// Interface for component props
interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  className?: string
  testId?: string
}

// Navigation items with role-based access control
const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: [UserRole.RECRUITER, UserRole.ADMIN, UserRole.HIRING_MANAGER],
    icon: "DashboardIcon",
    testId: "nav-dashboard"
  },
  {
    label: "Jobs",
    href: "/jobs",
    roles: [UserRole.RECRUITER, UserRole.ADMIN, UserRole.HIRING_MANAGER, UserRole.CANDIDATE],
    icon: "BriefcaseIcon",
    testId: "nav-jobs"
  },
  {
    label: "Candidates",
    href: "/candidates",
    roles: [UserRole.RECRUITER, UserRole.ADMIN, UserRole.HIRING_MANAGER],
    icon: "UsersIcon",
    testId: "nav-candidates"
  },
  {
    label: "Interviews",
    href: "/interviews",
    roles: [UserRole.RECRUITER, UserRole.ADMIN, UserRole.HIRING_MANAGER],
    icon: "CalendarIcon",
    testId: "nav-interviews"
  },
  {
    label: "Analytics",
    href: "/analytics",
    roles: [UserRole.ADMIN, UserRole.HIRING_MANAGER],
    icon: "BarChartIcon",
    testId: "nav-analytics"
  }
]

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  className,
  testId = "mobile-menu"
}) => {
  const { user, signOut, isAuthenticated } = useAuth()

  // Handle ESC key press to close menu
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleEscKey)
    return () => window.removeEventListener("keydown", handleEscKey)
  }, [isOpen, onClose])

  // Handle navigation with role validation
  const handleNavigation = useCallback(async (href: string, requiredRoles: UserRole[]) => {
    try {
      // Validate authentication and role access
      if (!isAuthenticated || !user) {
        window.location.href = "/login"
        return
      }

      if (!requiredRoles.includes(user.role)) {
        console.error("Access denied: Insufficient permissions")
        return
      }

      // Execute navigation
      window.location.href = href
      onClose()
    } catch (error) {
      console.error("Navigation error:", error)
    }
  }, [isAuthenticated, user, onClose])

  // Handle secure sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      onClose()
      window.location.href = "/login"
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }, [signOut, onClose])

  // Early return if menu is closed
  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-white dark:bg-gray-900 lg:hidden",
        className
      )}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
    >
      {/* Menu Container */}
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            data-testid={`${testId}-close`}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            // Skip items user doesn't have access to
            if (!user || !item.roles.includes(user.role)) return null

            return (
              <Button
                key={item.href}
                variant="ghost"
                className="w-full justify-start text-left"
                onClick={() => handleNavigation(item.href, item.roles)}
                data-testid={item.testId}
              >
                {item.label}
              </Button>
            )
          })}
        </nav>

        {/* Footer with Sign Out */}
        {isAuthenticated && (
          <div className="px-4 py-6 border-t border-gray-200 dark:border-gray-800">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSignOut}
              data-testid={`${testId}-sign-out`}
            >
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileMenu