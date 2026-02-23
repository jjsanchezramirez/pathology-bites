// src/shared/config/navigation.ts

export interface NavigationItem {
  name: string;
  href: string;
  icon: string; // Use string identifier instead of component
  requiredPermission?: string;
  adminOnly?: boolean;
  showToRoles?: string[]; // Array of roles that can see this item
  isNew?: boolean; // Badge to indicate feature is new
  isSoon?: boolean; // Badge to indicate feature is coming soon
  showBadge?: boolean; // Whether to show a badge count
  badgeKey?: "revisionQueue" | "reviewQueue" | "drafts"; // Key for fetching badge count
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export interface NavigationConfig {
  sections: NavigationSection[];
  userRole?: "admin" | "creator" | "reviewer" | "user";
}

// Admin/Creator/Reviewer Navigation Sections Configuration
export const adminNavigationSections: NavigationSection[] = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/admin",
        icon: "LayoutDashboard",
        requiredPermission: "dashboard.view",
      },
    ],
  },
  {
    title: "Questions",
    items: [
      {
        name: "Question Database",
        href: "/admin/questions",
        icon: "FileQuestion",
        requiredPermission: "questions.view",
        showToRoles: ["admin", "creator", "reviewer"], // Visible to all, but bulk operations only for admin
      },
      {
        name: "My Questions",
        href: "/admin/my-questions",
        icon: "FolderOpen",
        requiredPermission: "questions.view",
        showToRoles: ["admin", "creator", "reviewer"],
        showBadge: true,
        badgeKey: "drafts",
      },
      {
        name: "My Review Queue",
        href: "/admin/review-queue",
        icon: "ClipboardList",
        requiredPermission: "questions.review",
        showToRoles: ["admin", "reviewer"],
        showBadge: true,
        badgeKey: "reviewQueue",
      },
      {
        name: "Create Question",
        href: "/admin/questions/create",
        icon: "Brain",
        requiredPermission: "questions.create",
        showToRoles: ["admin", "creator"],
      },
      {
        name: "Question Metadata",
        href: "/admin/questions/metadata",
        icon: "Tags",
        requiredPermission: "categories.manage",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Media",
    items: [
      {
        name: "Images",
        href: "/admin/images",
        icon: "Image",
        requiredPermission: "images.manage",
        showToRoles: ["admin", "creator", "reviewer"],
      },
      {
        name: "Audio",
        href: "/admin/audio",
        icon: "AudioLines",
        requiredPermission: "audio.manage",
        showToRoles: ["admin"],
      },
      {
        name: "Lesson Studio",
        href: "/admin/lesson-studio",
        icon: "Clapperboard",
        requiredPermission: "images.manage",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Users",
    items: [
      {
        name: "Users",
        href: "/admin/users",
        icon: "Users",
        requiredPermission: "users.manage",
        adminOnly: true,
      },
      {
        name: "Notifications",
        href: "/admin/notifications",
        icon: "Bell",
        requiredPermission: "notifications.manage",
        adminOnly: true,
      },
      {
        name: "Manage Inquiries",
        href: "/admin/inquiries",
        icon: "MessageSquare",
        requiredPermission: "inquiries.manage",
        adminOnly: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        name: "Site Analytics",
        href: "/admin/analytics",
        icon: "BarChart",
        requiredPermission: "analytics.view",
        adminOnly: true,
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: "Settings",
        requiredPermission: "settings.manage",
        showToRoles: ["admin", "creator", "reviewer"],
      },
    ],
  },
];

// Helper function to get user navigation sections
// Note: Quiz features are always enabled now
export function getUserNavigationSections(): NavigationSection[] {
  return [
    {
      title: "Overview",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: "LayoutDashboard",
        },
      ],
    },
    {
      title: "Education",
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
          name: "Slide-Based Questions",
          href: "/dashboard/wsi-questions",
          icon: "Microscope",
          isNew: true,
        },
        {
          name: "Ankoma Deck Viewer",
          href: "/dashboard/anki",
          icon: "Library",
          isNew: true,
        },
      ],
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
          name: "Achievements",
          href: "/dashboard/achievements",
          icon: "Trophy",
        },
        {
          name: "My Progress",
          href: "/dashboard/progress",
          icon: "TrendingUp",
          isSoon: true,
        },
      ],
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
        },
      ],
    },
  ];
}

// Navigation configuration factory
export function getNavigationConfig(
  userRole: "admin" | "creator" | "reviewer" | "user"
): NavigationConfig {
  switch (userRole) {
    case "admin":
    case "creator":
    case "reviewer":
      return {
        sections: adminNavigationSections,
        userRole,
      };
    case "user":
    default:
      return {
        sections: getUserNavigationSections(),
        userRole: "user",
      };
  }
}

// Helper function to filter navigation items based on permissions and admin mode
export function filterNavigationItems(
  items: NavigationItem[],
  canAccess: (permission: string) => boolean,
  isAdmin: boolean,
  isLoading: boolean,
  adminMode?: string
): NavigationItem[] {
  return items.filter((item) => {
    // During loading, show all items to prevent layout shift
    if (isLoading) return true;

    // Once loaded, apply proper filtering
    // Check actual admin permissions for security
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiredPermission && !canAccess(item.requiredPermission)) return false;

    // Filter adminOnly items based on selected adminMode for role simulation
    if (item.adminOnly && adminMode && adminMode !== "admin") return false;

    // Filter based on adminMode if showToRoles is specified
    if (item.showToRoles && adminMode) {
      const currentViewRole = adminMode === "user" ? "user" : adminMode;
      if (!item.showToRoles.includes(currentViewRole)) return false;
    }

    return true;
  });
}

// Helper function to filter navigation sections based on permissions and admin mode
export function filterNavigationSections(
  sections: NavigationSection[],
  canAccess: (permission: string) => boolean,
  isAdmin: boolean,
  isLoading: boolean,
  adminMode?: string
): NavigationSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterNavigationItems(section.items, canAccess, isAdmin, isLoading, adminMode),
    }))
    .filter((section) => section.items.length > 0); // Only show sections that have visible items
}
