// src/shared/config/dashboard-themes.ts
export interface DashboardTheme {
  id: string
  name: string
  description: string
  preview: string
  variables: {
    light: Record<string, string>
    dark: Record<string, string>
  }
}

export const dashboardThemes: DashboardTheme[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean and professional default theme',
    preview: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    variables: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '222.2 84% 4.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '222.2 84% 4.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '222.2 84% 4.9%',
        '--primary': '186 66% 40%',
        '--primary-foreground': '0 0% 100%',
        '--secondary': '210 40% 96.1%',
        '--secondary-foreground': '222.2 47.4% 11.2%',
        '--muted': '210 40% 96.1%',
        '--muted-foreground': '215.4 16.3% 46.9%',
        '--accent': '210 40% 96.1%',
        '--accent-foreground': '222.2 47.4% 11.2%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '210 40% 98%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '186 66% 40%',
      },
      dark: {
        '--background': '222.2 84% 4.9%',
        '--foreground': '210 40% 98%',
        '--card': '222.2 84% 4.9%',
        '--card-foreground': '210 40% 98%',
        '--popover': '222.2 84% 4.9%',
        '--popover-foreground': '210 40% 98%',
        '--primary': '170 60% 70%',
        '--primary-foreground': '180 100% 10%',
        '--secondary': '217.2 32.6% 17.5%',
        '--secondary-foreground': '210 40% 98%',
        '--muted': '217.2 32.6% 17.5%',
        '--muted-foreground': '215 20.2% 65.1%',
        '--accent': '217.2 32.6% 17.5%',
        '--accent-foreground': '210 40% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '210 40% 98%',
        '--border': '217.2 32.6% 17.5%',
        '--input': '217.2 32.6% 17.5%',
        '--ring': '170 60% 70%',
      }
    }
  },
  {
    id: 'amber-minimal',
    name: 'Amber Minimal',
    description: 'Subtle amber accents with minimal design',
    preview: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    variables: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '0 0% 14.9020%',
        '--card': '0 0% 100%',
        '--card-foreground': '0 0% 14.9020%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '0 0% 14.9020%',
        '--primary': '37.6923 92.1260% 50.1961%',
        '--primary-foreground': '0 0% 0%',
        '--secondary': '220.0000 14.2857% 95.8824%',
        '--secondary-foreground': '215 13.7931% 34.1176%',
        '--muted': '210 20.0000% 98.0392%',
        '--muted-foreground': '220 8.9362% 46.0784%',
        '--accent': '48.0000 100.0000% 96.0784%',
        '--accent-foreground': '22.7273 82.5000% 31.3725%',
        '--destructive': '0 84.2365% 60.1961%',
        '--destructive-foreground': '0 0% 100%',
        '--border': '220 13.0435% 90.9804%',
        '--input': '220 13.0435% 90.9804%',
        '--ring': '37.6923 92.1260% 50.1961%',
        '--chart-1': '37.6923 92.1260% 50.1961%',
        '--chart-2': '32.1327 94.6188% 43.7255%',
        '--chart-3': '25.9649 90.4762% 37.0588%',
        '--chart-4': '22.7273 82.5000% 31.3725%',
        '--chart-5': '21.7143 77.7778% 26.4706%',
        '--sidebar': '210 20.0000% 98.0392%',
        '--sidebar-foreground': '0 0% 14.9020%',
        '--sidebar-primary': '37.6923 92.1260% 50.1961%',
        '--sidebar-primary-foreground': '0 0% 100%',
        '--sidebar-accent': '48.0000 100.0000% 96.0784%',
        '--sidebar-accent-foreground': '22.7273 82.5000% 31.3725%',
        '--sidebar-border': '220 13.0435% 90.9804%',
        '--sidebar-ring': '37.6923 92.1260% 50.1961%',
      },
      dark: {
        '--background': '0 0% 9.0196%',
        '--foreground': '0 0% 89.8039%',
        '--card': '0 0% 14.9020%',
        '--card-foreground': '0 0% 89.8039%',
        '--popover': '0 0% 14.9020%',
        '--popover-foreground': '0 0% 89.8039%',
        '--primary': '37.6923 92.1260% 50.1961%',
        '--primary-foreground': '0 0% 0%',
        '--secondary': '0 0% 14.9020%',
        '--secondary-foreground': '0 0% 89.8039%',
        '--muted': '0 0% 14.9020%',
        '--muted-foreground': '0 0% 63.9216%',
        '--accent': '22.7273 82.5000% 31.3725%',
        '--accent-foreground': '48 96.6387% 76.6667%',
        '--destructive': '0 84.2365% 60.1961%',
        '--destructive-foreground': '0 0% 100%',
        '--border': '0 0% 25.0980%',
        '--input': '0 0% 25.0980%',
        '--ring': '37.6923 92.1260% 50.1961%',
        '--chart-1': '43.2558 96.4126% 56.2745%',
        '--chart-2': '32.1327 94.6188% 43.7255%',
        '--chart-3': '22.7273 82.5000% 31.3725%',
        '--chart-4': '25.9649 90.4762% 37.0588%',
        '--chart-5': '22.7273 82.5000% 31.3725%',
        '--sidebar': '0 0% 5.8824%',
        '--sidebar-foreground': '0 0% 89.8039%',
        '--sidebar-primary': '37.6923 92.1260% 50.1961%',
        '--sidebar-primary-foreground': '0 0% 100%',
        '--sidebar-accent': '22.7273 82.5000% 31.3725%',
        '--sidebar-accent-foreground': '48 96.6387% 76.6667%',
        '--sidebar-border': '0 0% 25.0980%',
        '--sidebar-ring': '37.6923 92.1260% 50.1961%',
      }
    }
  }
]

export const getThemeById = (id: string): DashboardTheme | undefined => {
  return dashboardThemes.find(theme => theme.id === id)
}

export const getDefaultTheme = (): DashboardTheme => {
  return dashboardThemes[0] // Default theme
}
