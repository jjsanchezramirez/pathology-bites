// src/components/questions/question-table/question-table-loading.tsx
import { Skeleton } from '@/shared/components/ui/skeleton'
import { TableBody, TableCell, TableRow } from '@/shared/components/ui/table'

export function QuestionTableLoading() {
  return (
    <TableBody>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          {/* Question column */}
          <TableCell>
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          </TableCell>
          {/* Status/Date column */}
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          {/* Difficulty column */}
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
          {/* Actions column */}
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}