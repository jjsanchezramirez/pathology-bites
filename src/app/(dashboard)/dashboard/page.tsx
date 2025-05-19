// src/app/dashboard/page.tsx
"use client"

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="bg-white rounded-lg p-6 shadow-xs">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Total Questions</h3>
          <p className="text-3xl font-semibold">1,246</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-xs">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Questions Completed</h3>
          <p className="text-3xl font-semibold">128</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-xs">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Average Score</h3>
          <p className="text-3xl font-semibold">76%</p>
        </div>
      </div>
    </div>
  )
}