// src/components/dashboard/profile-dropdown.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User as LucideUser } from "lucide-react"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface UserDisplayInfo {
  displayName: string
  email: string
  avatarUrl?: string
}

export function ProfileDropdown() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const getUser = async () => {
      try {
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
        email: 'guest@example.com'
      }
    }

    return {
      displayName: user.email ? user.email.split('@')[0] : 'User',
      email: user.email || 'No email provided',
      avatarUrl: user.user_metadata?.avatar_url
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
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
          className="relative h-10 w-10 rounded-full border border-gray-200 hover:bg-gray-100 focus:ring-2 focus:ring-primary"
          disabled={isLoading}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={userInfo.avatarUrl || "/avatars/placeholder.png"} 
              alt={`${userInfo.displayName}'s profile`} 
            />
            <AvatarFallback>
              <LucideUser className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
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