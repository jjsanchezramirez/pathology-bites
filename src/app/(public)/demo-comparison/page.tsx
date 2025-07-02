'use client'

import DemoQuestion from "@/shared/components/common/demo-question"
import DemoQuestionV2 from "@/shared/components/common/demo-question-v2"

export default function DemoComparisonPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Demo Question Component Comparison</h1>
          <p className="text-gray-600">Compare the old component (left) with the new reinvented component (right)</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Old Component */}
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-red-800 mb-2">
                🐛 Old Component (Current)
              </h2>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Complex animations and state management</li>
                <li>• Resizing issues when loading new questions</li>
                <li>• Over-engineered image viewer with cropping</li>
                <li>• Multiple animation timing conflicts</li>
                <li>• 270+ lines of complex code</li>
              </ul>
            </div>
            <DemoQuestion />
          </div>

          {/* New Component */}
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-green-800 mb-2">
                ✨ New Component (Reinvented)
              </h2>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Simple, stable state management</li>
                <li>• Fixed dimensions, no resizing</li>
                <li>• Clean image viewer, no cropping</li>
                <li>• No animations, instant updates</li>
                <li>• 180 lines of clean code</li>
              </ul>
            </div>
            <DemoQuestionV2 />
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">Test Instructions</h3>
          <div className="text-blue-700 space-y-2">
            <p><strong>Try these actions on both components:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Click "Try Another Question" multiple times - notice resizing differences</li>
              <li>Click on images to open them - compare the image viewers</li>
              <li>Answer questions and see the explanation flow</li>
              <li>Test on mobile devices for responsiveness</li>
            </ol>
            <p className="mt-4"><strong>Key differences to notice:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Height stability when changing questions</li>
              <li>Image viewing experience (cropping vs full image)</li>
              <li>Animation smoothness and complexity</li>
              <li>Overall reliability and performance</li>
            </ul>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <a 
            href="/coming-soon" 
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Coming Soon Page
          </a>
        </div>
      </div>
    </div>
  )
}
