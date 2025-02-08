// src/components/questions/question-table/question-table-header.tsx
export function QuestionTableHeader() {
    return (
      <thead className="bg-muted/50">
        <tr>
          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-medium text-muted-foreground">
            Question
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Categories
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Images
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Difficulty
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Yield
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Updated
          </th>
          <th scope="col" className="relative py-3.5 pl-3 pr-4">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
    )
  }