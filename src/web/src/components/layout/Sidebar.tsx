import React, { memo, useCallback } from 'react'; // ^18.0.0
import { Link, useLocation } from 'react-router-dom'; // ^6.0.0
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import useAuth from '../../lib/hooks/useAuth';
import useMediaQuery from '../../lib/hooks/useMediaQuery';
import { UserRole } from '../../types/auth';

// Icons for navigation items
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  ChartBar,
  Settings,
  Menu,
  X,
} from 'lucide-react'; // ^0.171.0

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles?: UserRole[];
}

// Navigation items with role-based access
const getNavigationItems = (userRole?: UserRole): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER],
    },
    {
      path: '/jobs',
      label: 'Jobs',
      icon: <Briefcase className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER],
    },
    {
      path: '/candidates',
      label: 'Candidates',
      icon: <Users className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.RECRUITER],
    },
    {
      path: '/interviews',
      label: 'Interviews',
      icon: <Calendar className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER],
    },
    {
      path: '/analytics',
      label: 'Analytics',
      icon: <ChartBar className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.RECRUITER],
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      roles: [UserRole.ADMIN],
    },
  ];

  // Filter items based on user role
  return userRole
    ? baseItems.filter(
        item => !item.roles || item.roles.includes(userRole)
      )
    : baseItems.filter(item => !item.roles); // Public items for guests
};

const Sidebar = memo<SidebarProps>(({ isOpen, onClose, className }) => {
  const { state: { user } } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 639px)');

  // Get navigation items based on user role
  const navigationItems = getNavigationItems(user?.role as UserRole);

  // Check if current path matches navigation item
  const isActivePath = useCallback((path: string): boolean => {
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  // Render navigation item
  const renderNavItem = (item: NavigationItem) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={isMobile ? onClose : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isActivePath(item.path)
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground'
      )}
      aria-current={isActivePath(item.path) ? 'page' : undefined}
    >
      {item.icon}
      <span className="text-sm font-medium">{item.label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-background border-r',
          'transition-transform duration-200 ease-in-out',
          isMobile && !isOpen && '-translate-x-full',
          className
        )}
        aria-label="Sidebar navigation"
      >
        {/* Mobile header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b">
            <span className="text-lg font-semibold">HotGigs</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex flex-col gap-1 p-4" role="navigation">
          {navigationItems.map(renderNavItem)}
        </nav>
      </aside>

      {/* Mobile toggle button */}
      {isMobile && !isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50"
          onClick={() => onClose()}
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </Button>
      )}
    </>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;