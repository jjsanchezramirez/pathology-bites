import { Badge } from '@/shared/components/ui/badge'
import { Clock, CheckCircle, XCircle } from 'lucide-react'

interface InquiryStatusBadgeProps {
  status: string
  className?: string
}

export function InquiryStatusBadge({ status, className }: InquiryStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          label: 'Pending',
          variant: 'secondary' as const,
          icon: Clock,
          className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
        }
      case 'resolved':
        return {
          label: 'Resolved',
          variant: 'default' as const,
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 hover:bg-green-100'
        }
      case 'closed':
        return {
          label: 'Closed',
          variant: 'outline' as const,
          icon: XCircle,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-100'
        }
      default:
        return {
          label: status,
          variant: 'outline' as const,
          icon: Clock,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-100'
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  )
}
