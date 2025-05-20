// src/components/dashboard/profile-dropdown.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from '@/lib/supabase/client'
import { useToast } from "@/hooks/use-toast"
import ProfileAvatar from "@/components/dashboard/profile-avatar"

interface UserDisplayInfo {
  displayName: string
  email: string
  avatarUrl?: string | null
}

export function ProfileDropdown() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const getUser = async () => {
      try {
        // Use createClient() function instead of global supabase variable
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          throw error
        }
        
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load user profile",
        })
      } finally {
        setIsLoading(false)
      }
    }
    
    getUser()
  }, [toast])

  const getUserDisplayInfo = (user: User | null): UserDisplayInfo => {
    if (!user) {
      return {
        displayName: 'Guest',
        email: 'guest@example.com',
        avatarUrl: null
      }
    }

    const name = user.user_metadata?.first_name 
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
      : user.email?.split('@')[0] || 'User'

    return {
      displayName: name,
      email: user.email || 'No email provided',
      avatarUrl: user.user_metadata?.avatar_url
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }
      
      router.push('/login')
      toast({
        title: "Success",
        description: "Successfully logged out",
      })
    } catch (error) {
      console.error('Error signing out:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNavigation = (path: string) => {
    try {
      router.push(path)
    } catch (error) {
      console.error('Navigation error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to navigate. Please try again.",
      })
    }
  }

  const userInfo = getUserDisplayInfo(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 rounded-full"
          disabled={isLoading}
        >
          <ProfileAvatar
            url={userInfo.avatarUrl}
            name={userInfo.displayName}
            className="h-10 w-10"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userInfo.displayName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userInfo.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => handleNavigation('/dashboard/profile')}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => handleNavigation('/dashboard/settings')}
          >
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-red-600 cursor-pointer focus:text-red-600" 
          onClick={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? 'Logging out...' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}