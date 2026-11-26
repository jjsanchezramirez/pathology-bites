// src/shared/config/navigation.ts

export interface NavigationItem {
  name: string;
  href: string;
  icon: string; // Use string identifier instead of component
  requiredPermission?: string;
  adminOnly?: boolean;
  isNew?: boolean; // Badge to indicate feature is new
  isSoon?: boolean; // Badge to indicate feature is coming soon
  showBadge?: boolean; // Whether to show a badge count
  badgeKey?: "revisionQueue" | "reviewQueue" | "drafts" | "myQuestions"; // Key for fetching badge count
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export interface NavigationConfig {
  sections: NavigationSection[];
  mode?: "admin" | "user";
}

// Admin-area navigation (admins and anyone holding a permission; items gate on canAccess)
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
      },
      {
        name: "My Questions",
        href: "/admin/my-questions",
        icon: "FolderOpen",
        requiredPermission: "questions.create",
        showBadge: true,
        badgeKey: "myQuestions",
      },
      {
        name: "My Review Queue",
        href: "/admin/review-queue",
        icon: "ClipboardList",
        requiredPermission: "questions.review",
        showBadge: true,
        badgeKey: "reviewQueue",
      },
      {
        name: "Create Question",
        href: "/admin/questions/create",
        icon: "Brain",
        requiredPermission: "questions.create",
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
        name: "Media",
        href: "/admin/media",
        icon: "Image",
        requiredPermission: "images.manage",
        adminOnly: true,
      },
    ],
  },
  {
    title: "Learning",
    items: [
      {
        name: "Lesson Studio",
        href: "/admin/lesson-studio",
        icon: "Clapperboard",
        requiredPermission: "lessons.manage",
        adminOnly: true,
      },
      {
        name: "Learning Modules",
        href: "/admin/learn",
        icon: "BookOpen",
        requiredPermission: "lessons.manage",
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
        isSoon: true,
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: "Settings",
        requiredPermission: "settings.manage",
        adminOnly: true,
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
      title: "Practice",
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
        },
      ],
    },
    {
      title: "Study",
      items: [
        {
          name: "Ankoma Deck Viewer",
          href: "/dashboard/anki",
          icon: "Library",
        },
        {
          name: "Study Plan",
          href: "/dashboard/study-plan",
          icon: "CalendarDays",
          isNew: true,
        },
        {
          name: "Learning Modules",
          href: "/dashboard/learn",
          icon: "BookOpen",
          isSoon: true,
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
      title: "Tools",
      items: [
        {
          name: "Cell Counter",
          href: "/tools/cell-counter",
          icon: "Calculator",
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

// Guest/USCAP Navigation Sections Configuration
// RETIRED: USCAP pages removed (April 2026). Guest-quiz pattern preserved in dev/reference/guest-quiz/.
// export function getGuestNavigationSections(): NavigationSection[] {
//   return [
//     {
//       title: "Overview",
//       items: [
//         { name: "Dashboard", href: "/uscap", icon: "LayoutDashboard" },
//       ],
//     },
//     {
//       title: "Education",
//       items: [
//         { name: "New Quiz", href: "/uscap/quiz", icon: "Plus" },
//         { name: "Slide-Based Questions", href: "/uscap/wsi-questions", icon: "Microscope" },
//         { name: "Ankoma Deck Viewer", href: "/uscap/anki", icon: "Library" },
//       ],
//     },
//     {
//       title: "Tools",
//       items: [
//         { name: "Browse Virtual Slides", href: "/tools/virtual-slides", icon: "Image" },
//         { name: "Hemapath Quiz", href: "/tools/cell-quiz", icon: "Target" },
//         { name: "ABPath Content Specs", href: "/tools/abpath", icon: "BookOpen" },
//       ],
//     },
//   ];
// }

// Navigation configuration factory
export function getNavigationConfig(mode: "admin" | "user"): NavigationConfig {
  return mode === "admin"
    ? { sections: adminNavigationSections, mode }
    : { sections: getUserNavigationSections(), mode: "user" };
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

    // Admin-only items never show in the student view
    if (item.adminOnly && adminMode && adminMode !== "admin") return false;

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
