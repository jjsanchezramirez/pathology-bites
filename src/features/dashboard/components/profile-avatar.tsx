import { User as LucideUser } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"

interface ProfileAvatarProps {
  url?: string | null
  name: string
  className?: string
}

export default function ProfileAvatar({ url, name, className }: ProfileAvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Avatar className={className}>
      {url ? (
        <AvatarImage 
          src={url} 
          alt={`${name}'s profile`}
          onError={(e) => {
            // On error, remove the src to show fallback
            e.currentTarget.src = ''
          }}
        />
      ) : null}
      <AvatarFallback className="bg-primary/10">
        {initials || <LucideUser className="h-5 w-5 text-primary" />}
      </AvatarFallback>
    </Avatar>
  )
}