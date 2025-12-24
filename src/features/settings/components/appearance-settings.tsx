'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Moon, Sun, Minus, Plus } from 'lucide-react'
import { getTextZoomConfig, getValidZoomLevel } from '@/shared/utils/text-zoom'

interface AppearanceSettingsProps {
  theme: string
  mounted: boolean
  saving: boolean
  dashboardTheme: { id: string; name: string; preview: string }
  availableThemes: Array<{ id: string; name: string; preview: string }>
  textZoom: number
  onThemeChange: (theme: string) => void
  onDashboardThemeChange: (theme: string) => void
  onTextZoomChange: (zoom: number) => void
}

export function AppearanceSettings({
  theme,
  mounted,
  saving,
  dashboardTheme,
  availableThemes,
  textZoom,
  onThemeChange,
  onDashboardThemeChange,
  onTextZoomChange
}: AppearanceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mounted && theme === 'dark' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
          Appearance
        </CardTitle>
        <CardDescription>
          Customize how the application looks and feels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Light/Dark Mode</Label>
          <p className="text-sm text-muted-foreground">
            Choose your preferred color scheme
          </p>
          <Select
            value={mounted ? theme : 'system'}
            onValueChange={onThemeChange}
            disabled={!mounted || saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  System
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Dashboard Theme</Label>
          <p className="text-sm text-muted-foreground">
            Choose your preferred dashboard color scheme
          </p>
          <Select
            value={dashboardTheme.id}
            onValueChange={onDashboardThemeChange}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ background: theme.preview }}
                    />
                    {theme.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Text Size</Label>
          <p className="text-sm text-muted-foreground">
            Adjust the size of text throughout the application
          </p>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const config = getTextZoomConfig()
                const newZoom = Math.max(config.min, textZoom - config.step)
                const validZoom = getValidZoomLevel(newZoom)
                onTextZoomChange(validZoom)
              }}
              disabled={saving || textZoom <= getTextZoomConfig().min}
              className="h-8 w-8"
              title="Decrease text size"
            >
              <Minus size={14} />
            </Button>

            <div className="text-sm text-muted-foreground min-w-[4rem] text-center">
              {Math.round(textZoom * 100)}%
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const config = getTextZoomConfig()
                const newZoom = Math.min(config.max, textZoom + config.step)
                const validZoom = getValidZoomLevel(newZoom)
                onTextZoomChange(validZoom)
              }}
              disabled={saving || textZoom >= getTextZoomConfig().max}
              className="h-8 w-8"
              title="Increase text size"
            >
              <Plus size={14} />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Range: {Math.round(getTextZoomConfig().min * 100)}% - {Math.round(getTextZoomConfig().max * 100)}%
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

