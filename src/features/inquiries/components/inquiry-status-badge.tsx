import { Badge } from '@/shared/components/ui/badge'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface InquiryStatusBadgeProps {
  status: string
  createdAt?: string
  className?: string
}

export function InquiryStatusBadge({ status, createdAt, className }: InquiryStatusBadgeProps) {
  const isDelayed = (createdAt: string) => {
    const inquiryDate = new Date(createdAt)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return inquiryDate < sevenDaysAgo
  }

  const getStatusConfig = (status: string) => {
    const statusLower = status.toLowerCase()

    // Resolved/Closed = Green
    if (statusLower === 'resolved' || statusLower === 'closed') {
      return {
        label: statusLower === 'resolved' ? 'Resolved' : 'Closed',
        variant: 'default' as const,
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 hover:bg-green-100'
      }
    }

    // Pending = Yellow or Red (if delayed)
    if (statusLower === 'pending') {
      const delayed = createdAt && isDelayed(createdAt)
      if (delayed) {
        return {
          label: 'Delayed',
          variant: 'destructive' as const,
          icon: AlertCircle,
          className: 'bg-red-100 text-red-800 hover:bg-red-100'
        }
      }
      return {
        label: 'Pending',
        variant: 'secondary' as const,
        icon: Clock,
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
      }
    }

    // Default
    return {
      label: status,
      variant: 'outline' as const,
      icon: Clock,
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100'
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

// Helper function to get status sort order for "All Inquiries" tab
export function getStatusSortOrder(status: string, createdAt: string): number {
  const statusLower = status.toLowerCase()

  // Check if pending inquiry is delayed (>7 days old)
  const isDelayed = () => {
    const inquiryDate = new Date(createdAt)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return inquiryDate < sevenDaysAgo
  }

  // Red (Delayed) = 0, Yellow (Pending) = 1, Green (Resolved/Closed) = 2
  if (statusLower === 'pending' && isDelayed()) {
    return 0 // Red - Delayed
  }
  if (statusLower === 'pending') {
    return 1 // Yellow - Pending
  }
  if (statusLower === 'resolved' || statusLower === 'closed') {
    return 2 // Green - Resolved/Closed
  }

  return 3 // Unknown
}
