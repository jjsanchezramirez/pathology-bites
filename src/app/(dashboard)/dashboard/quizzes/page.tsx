// src/app/(dashboard)/dashboard/quizzes/page.tsx

export default function QuizzesPage() {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Quizzes</h1>
            <p className="text-muted-foreground">View your recent quizzes and start new ones</p>
          </div>
          <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
            Start New Quiz
          </button>
        </div>
  
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { id: 1, title: "General Pathology Quiz", questions: 25, completed: 25, score: "85%" },
            { id: 2, title: "Renal Pathology Quiz", questions: 20, completed: 18, score: "78%" },
            { id: 3, title: "Dermatopathology Quiz", questions: 30, completed: 15, score: "In Progress" },
            { id: 4, title: "Hematopathology Quiz", questions: 20, completed: 0, score: "Not Started" },
            { id: 5, title: "GI Pathology Quiz", questions: 25, completed: 25, score: "92%" },
            { id: 6, title: "Neuropathology Quiz", questions: 15, completed: 15, score: "73%" }
          ].map((quiz) => (
            <div 
              key={quiz.id} 
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-medium mb-2">{quiz.title}</h3>
              <div className="flex justify-between text-sm text-muted-foreground mb-3">
                <span>{quiz.questions} questions</span>
                <span>{quiz.completed}/{quiz.questions} completed</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${(quiz.completed / quiz.questions) * 100}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">
                  {typeof quiz.score === 'string' && quiz.score.includes('%') 
                    ? <span className="text-green-600 dark:text-green-400">{quiz.score}</span> 
                    : quiz.score}
                </span>
                <button className="text-sm text-primary hover:text-primary/80">
                  {quiz.completed === 0 ? 'Start' : quiz.completed < quiz.questions ? 'Continue' : 'Review'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Recommended Quizzes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { id: 7, title: "Cytopathology Quiz", difficulty: "Medium", questions: 25 },
              { id: 8, title: "Breast Pathology Quiz", difficulty: "Hard", questions: 20 }
            ].map((quiz) => (
              <div 
                key={quiz.id} 
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{quiz.title}</h3>
                  <div className="text-sm text-muted-foreground">
                    {quiz.questions} questions • {quiz.difficulty} difficulty
                  </div>
                </div>
                <button className="px-3 py-1 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20">
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }