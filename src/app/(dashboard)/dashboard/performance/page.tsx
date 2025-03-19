// src/app/(dashboard)/dashboard/performance/page.tsx

export default function PerformancePage() {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Track your learning progress and identify areas for improvement.
        </p>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall Score</h3>
              <p className="text-3xl font-semibold">78%</p>
              <p className="text-sm text-green-600 dark:text-green-400">↑ 4% from last month</p>
            </div>
          </div>
  
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Questions Completed</h3>
              <p className="text-3xl font-semibold">245</p>
              <p className="text-sm text-green-600 dark:text-green-400">↑ 23 from last month</p>
            </div>
          </div>
  
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Study Time</h3>
              <p className="text-3xl font-semibold">18.5h</p>
              <p className="text-sm text-green-600 dark:text-green-400">↑ 2.5h from last month</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Performance by Category</h3>
          <div className="space-y-4">
            {/* Sample category performance bars */}
            {[
              { name: "Renal Pathology", score: 82 },
              { name: "Dermatopathology", score: 76 },
              { name: "Hematopathology", score: 91 },
              { name: "GI Pathology", score: 68 },
              { name: "Neuropathology", score: 73 }
            ].map((category) => (
              <div key={category.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{category.name}</span>
                  <span className="font-medium">{category.score}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full" 
                    style={{ width: `${category.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {[
                { title: "Completed Quiz: Renal Pathology", date: "Today", score: "8/10" },
                { title: "Reviewed Flashcards: Dermatopathology", date: "Yesterday", score: null },
                { title: "Completed Quiz: Hematopathology", date: "2 days ago", score: "9/10" },
                { title: "Practice Test: Mixed Topics", date: "3 days ago", score: "28/35" }
              ].map((activity, index) => (
                <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                  <div>
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activity.date}</p>
                  </div>
                  {activity.score && (
                    <span className="text-sm font-medium">{activity.score}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Recommended Focus Areas</h3>
            <div className="space-y-3">
              {[
                { area: "GI Pathology", reason: "Below average performance" },
                { area: "Neuropathology", reason: "Low completion rate" },
                { area: "Cytopathology", reason: "Not started yet" }
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-sm">{item.area}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }