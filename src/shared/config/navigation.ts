// src/shared/config/navigation.ts

export interface NavigationItem {
  name: string
  href: string
  icon: string // Use string identifier instead of component
  requiredPermission?: string
  adminOnly?: boolean
}

export interface NavigationSection {
  title: string
  items: NavigationItem[]
}

export interface NavigationConfig {
  items?: NavigationItem[]
  sections?: NavigationSection[]
  userRole?: 'admin' | 'creator' | 'reviewer' | 'user'
}

// Admin/Creator/Reviewer Navigation Configuration
export const adminNavigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: "LayoutDashboard",
    requiredPermission: "dashboard.view"
  },
  // Question Management Section
  {
    name: "Question Base",
    href: "/admin/questions",
    icon: "FileQuestion",
    requiredPermission: "questions.view"
  },
  {
    name: "My Questions",
    href: "/admin/my-questions",
    icon: "FileQuestion",
    requiredPermission: "questions.create"
  },
  {
    name: "My Review Queue",
    href: "/admin/review-queue",
    icon: "ClipboardList",
    requiredPermission: "questions.review"
  },
  {
    name: "Create Question",
    href: "/admin/create-question",
    icon: "Brain",
    requiredPermission: "questions.create"
  },
  
  // Content Management Section
  {
    name: "Question Labels",
    href: "/admin/labels",
    icon: "Tags",
    requiredPermission: "categories.manage",
    adminOnly: true
  },
  {
    name: "Images",
    href: "/admin/images",
    icon: "Image",
    requiredPermission: "images.manage",
    adminOnly: true
  },
  // User Management Section
  {
    name: "Users",
    href: "/admin/users",
    icon: "Users",
    requiredPermission: "users.manage",
    adminOnly: true
  },
  {
    name: "Invite Users",
    href: "/admin/invite-users",
    icon: "UserPlus",
    requiredPermission: "users.manage",
    adminOnly: true
  },
  {
    name: "Manage Inquiries",
    href: "/admin/inquiries",
    icon: "MessageSquare",
    requiredPermission: "inquiries.manage",
    adminOnly: true
  },
  // System Section
  {
    name: "Site Analytics",
    href: "/admin/analytics",
    icon: "BarChart",
    requiredPermission: "analytics.view",
    adminOnly: true
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    icon: "Megaphone",
    requiredPermission: "notifications.manage",
    adminOnly: true
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: "Settings",
    requiredPermission: "settings.manage",
    adminOnly: true
  }
]

// Admin/Creator/Reviewer Navigation Sections Configuration
export const adminNavigationSections: NavigationSection[] = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/admin/dashboard",
        icon: "LayoutDashboard",
        requiredPermission: "dashboard.view"
      }
    ]
  },
  {
    title: "Question Management",
    items: [
      {
        name: "Question Base",
        href: "/admin/questions",
        icon: "FileQuestion",
        requiredPermission: "questions.view"
      },
      {
        name: "My Questions",
        href: "/admin/my-questions",
        icon: "FileQuestion",
        requiredPermission: "questions.create"
      },
      {
        name: "My Review Queue",
        href: "/admin/review-queue",
        icon: "ClipboardList",
        requiredPermission: "questions.review"
      },
      {
        name: "Create Question",
        href: "/admin/create-question",
        icon: "Brain",
        requiredPermission: "questions.create"
      },
      {
        name: "Question Labels",
        href: "/admin/labels",
        icon: "Tags",
        requiredPermission: "categories.manage",
        adminOnly: true
      }
    ]
  },
  {
    title: "Content Management",
    items: [
      {
        name: "Images",
        href: "/admin/images",
        icon: "Image",
        requiredPermission: "images.manage",
        adminOnly: true
      }
    ]
  },
  {
    title: "User Management",
    items: [
      {
        name: "Users",
        href: "/admin/users",
        icon: "Users",
        requiredPermission: "users.manage",
        adminOnly: true
      },
      {
        name: "Invite Users",
        href: "/admin/invite-users",
        icon: "User",
        requiredPermission: "users.manage",
        adminOnly: true
      },
      {
        name: "Manage Inquiries",
        href: "/admin/inquiries",
        icon: "MessageSquare",
        requiredPermission: "inquiries.manage",
        adminOnly: true
      }
    ]
  },
  {
    title: "System Administration",
    items: [
      {
        name: "Site Analytics",
        href: "/admin/analytics",
        icon: "BarChart",
        requiredPermission: "analytics.view",
        adminOnly: true
      },
      {
        name: "Notifications",
        href: "/admin/notifications",
        icon: "MessageSquare",
        requiredPermission: "notifications.manage",
        adminOnly: true
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: "Settings",
        requiredPermission: "settings.manage",
        adminOnly: true
      }
    ]
  }
]

// User Navigation Configuration
export const userNavigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    name: "New Quiz",
    href: "/dashboard/quiz/new",
    icon: "Plus",
  },
  {
    name: "My Quizzes",
    href: "/dashboard/quizzes",
    icon: "ClipboardList",
  },
  {
    name: "WSI Questions (Beta)",
    href: "/dashboard/wsi-questions",
    icon: "Microscope",
  },
  {
    name: "Performance",
    href: "/dashboard/performance",
    icon: "BarChart2",
  },
  {
    name: "Learning Modules",
    href: "/dashboard/learning",
    icon: "BookOpen",
  },
  {
    name: "Goals",
    href: "/dashboard/goals",
    icon: "Target",
  },
  {
    name: "Progress",
    href: "/dashboard/progress",
    icon: "TrendingUp",
  },
  {
    name: "Profile",
    href: "/dashboard/profile",
    icon: "User",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: "Settings",
  },
]

// User Navigation Sections Configuration
export const userNavigationSections: NavigationSection[] = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
      }
    ]
  },
  {
    title: "Study & Practice",
    items: [
      {
        name: "New Quiz",
        href: "/dashboard/quiz/new",
        icon: "Plus",
      },
      {
        name: "My Quizzes",
        href: "/dashboard/quizzes",
        icon: "ClipboardList",
      },
      {
        name: "WSI Questions (Beta)",
        href: "/dashboard/wsi-questions",
        icon: "Microscope",
      },
      {
        name: "Learning Modules",
        href: "/dashboard/learning",
        icon: "BookOpen",
      }
    ]
  },
  {
    title: "Analytics",
    items: [
      {
        name: "Performance",
        href: "/dashboard/performance",
        icon: "BarChart2",
      },
      {
        name: "Goals",
        href: "/dashboard/goals",
        icon: "Target",
      },
      {
        name: "Progress",
        href: "/dashboard/progress",
        icon: "TrendingUp",
      }
    ]
  },
  {
    title: "Account",
    items: [
      {
        name: "Profile",
        href: "/dashboard/profile",
        icon: "User",
      },
      {
        name: "Settings",
        href: "/dashboard/settings",
        icon: "Settings",
      }
    ]
  }
]

// Navigation configuration factory
export function getNavigationConfig(userRole: 'admin' | 'creator' | 'reviewer' | 'user'): NavigationConfig {
  switch (userRole) {
    case 'admin':
    case 'creator':
    case 'reviewer':
      return {
        sections: adminNavigationSections,
        items: adminNavigationItems, // Keep for backward compatibility
        userRole
      }
    case 'user':
    default:
      return {
        sections: userNavigationSections,
        items: userNavigationItems, // Keep for backward compatibility
        userRole: 'user'
      }
  }
}

// Helper function to filter navigation items based on permissions
export function filterNavigationItems(
  items: NavigationItem[],
  canAccess: (permission: string) => boolean,
  isAdmin: boolean,
  isLoading: boolean
): NavigationItem[] {
  return items.filter(item => {
    if (isLoading) return true // Show all items while loading
    if (item.adminOnly && !isAdmin) return false
    if (item.requiredPermission && !canAccess(item.requiredPermission)) return false
    return true
  })
}

// Helper function to filter navigation sections based on permissions
export function filterNavigationSections(
  sections: NavigationSection[],
  canAccess: (permission: string) => boolean,
  isAdmin: boolean,
  isLoading: boolean
): NavigationSection[] {
  return sections
    .map(section => ({
      ...section,
      items: filterNavigationItems(section.items, canAccess, isAdmin, isLoading)
    }))
    .filter(section => section.items.length > 0) // Only show sections that have visible items
}
