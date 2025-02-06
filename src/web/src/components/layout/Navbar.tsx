"use client"

import * as React from "react" // ^18.0.0
import { Link } from "react-router-dom" // ^6.0.0
import { Button } from "../ui/button"
import { Avatar } from "../ui/avatar"
import * as DropdownMenu from "../ui/dropdown"
import { useAuth } from "../../lib/hooks/useAuth"
import { cn } from "../../lib/utils"
import { UserRole } from "../../types/auth"

// Navigation item type definition
interface NavItem {
  label: string
  href: string
  roles: UserRole[]
}

// Navigation configuration with role-based access
const navigationItems: NavItem[] = [
  { 
    label: "Dashboard", 
    href: "/dashboard", 
    roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER] 
  },
  { 
    label: "Jobs", 
    href: "/jobs", 
    roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER, UserRole.CANDIDATE] 
  },
  { 
    label: "Candidates", 
    href: "/candidates", 
    roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER] 
  },
  { 
    label: "Analytics", 
    href: "/analytics", 
    roles: [UserRole.ADMIN, UserRole.RECRUITER] 
  }
]

interface NavbarProps {
  className?: string
}

export const Navbar: React.FC<NavbarProps> = React.memo(({ className }) => {
  const { state, logout, validateSession } = useAuth()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  // Handle scroll effect
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Validate session on mount and after inactivity
  React.useEffect(() => {
    const validateUserSession = async () => {
      const isValid = await validateSession()
      if (!isValid) {
        await logout()
      }
    }

    validateUserSession()
    const interval = setInterval(validateUserSession, 5 * 60 * 1000) // Check every 5 minutes
    return () => clearInterval(interval)
  }, [validateSession, logout])

  // Handle secure logout
  const handleLogout = React.useCallback(async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }, [logout])

  // Filter navigation items based on user role
  const filteredNavItems = React.useMemo(() => {
    return navigationItems.filter(item => 
      item.roles.includes(state.user?.role || UserRole.GUEST)
    )
  }, [state.user?.role])

  // Render user menu
  const renderUserMenu = React.useCallback(() => {
    if (!state.user) return null

    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full"
            aria-label="User menu"
          >
            <Avatar
              src={state.user.profile.avatar_url || undefined}
              alt={state.user.full_name}
              fallback={state.user.full_name}
              className="h-10 w-10"
            />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="w-56">
          <DropdownMenu.Item className="flex items-center" asChild>
            <Link to="/profile">Profile Settings</Link>
          </DropdownMenu.Item>
          {state.user.role === UserRole.ADMIN && (
            <DropdownMenu.Item className="flex items-center" asChild>
              <Link to="/admin">Admin Panel</Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            className="flex items-center text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    )
  }, [state.user, handleLogout])

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        isScrolled && "shadow-sm",
        className
      )}
      role="banner"
    >
      <nav
        className="container mx-auto flex h-16 items-center px-4"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center space-x-2"
          aria-label="HotGigs home"
        >
          <span className="text-xl font-bold">HotGigs</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:ml-10 md:flex md:items-center md:space-x-4">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center space-x-4">
          {/* Search Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          {state.user ? (
            renderUserMenu()
          ) : (
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-b md:hidden"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="space-y-1 px-4 pb-3 pt-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent hover:text-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
})

Navbar.displayName = "Navbar"

// Icon components
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
)

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

export default Navbar