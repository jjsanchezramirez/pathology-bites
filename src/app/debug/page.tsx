// src/app/debug/page.tsx
export default function DebugPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      <p>Current environment: {process.env.NODE_ENV}</p>
      <p>Coming soon mode: {process.env.NEXT_PUBLIC_COMING_SOON_MODE}</p>
      <p>
        <a href="/api/auth/debug" className="text-blue-500 underline">
          View Auth Debug Info
        </a>
      </p>
    </div>
  );
}