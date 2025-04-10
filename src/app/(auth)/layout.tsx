// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The layout is now only a simple wrapper
  // Most styling will be handled by AuthPageLayout component
  return children
}