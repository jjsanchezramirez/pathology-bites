// src/app/(dashboard)/dashboard/quizzes/[id]/page.tsx

export default function QuizDetailsPage() {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Quiz Details</h1>
        <p className="text-muted-foreground">
          This is a placeholder for the quiz details page.
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Quiz Summary</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-md">
              <div className="text-sm text-muted-foreground">Total Questions</div>
              <div className="text-2xl font-bold">25</div>
            </div>
            
            <div className="p-4 border rounded-md">
              <div className="text-sm text-muted-foreground">Completion</div>
              <div className="text-2xl font-bold">80%</div>
            </div>
            
            <div className="p-4 border rounded-md">
              <div className="text-sm text-muted-foreground">Time Spent</div>
              <div className="text-2xl font-bold">18:24</div>
            </div>
          </div>
        </div>
      </div>
    )
  }