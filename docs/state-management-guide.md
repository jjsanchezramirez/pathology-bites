# 🏗️ State Management Guide

## Overview

Pathology Bites uses a **simple, effective state management approach** without complex state libraries like Redux or Zustand. This approach leverages React's built-in state management combined with server-side state from Supabase.

## 🎯 State Management Architecture

### 1. Local Component State (`useState`)

**Purpose**: Component-specific UI state, form inputs, loading states, modal states

**Example**:
```typescript
const [loading, setLoading] = useState(false)
const [items, setItems] = useState<ReviewQueueItem[]>([])
const [activeTab, setActiveTab] = useState('all')
const [modalOpen, setModalOpen] = useState(false)
```

**Used for**:
- Form field values
- Loading indicators
- Modal open/close states
- Component-specific UI state
- Temporary data that doesn't need to persist

### 2. Server State (SWR + Supabase)

**Purpose**: Database queries, API calls, real-time data

**Pattern**:
```typescript
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)

const fetchData = async () => {
  try {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('table').select('*')
    if (error) throw error
    setData(data)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
```

**Used for**:
- Database queries
- API responses
- Real-time subscriptions
- Server-derived data

### 3. Authentication State (Custom Hook)

**Purpose**: Centralized authentication and user state

**Usage**:
```typescript
const { user, isAuthenticated, isLoading, error } = useAuth()
```

**Features**:
- User authentication status
- User profile data
- Role-based permissions
- Session management
- Security risk assessment

### 4. URL State (Next.js Router + Search Params)

**Purpose**: Navigation and shareable state

**Example**:
```typescript
// With Suspense boundary (required in Next.js 15)
function TabInitializer({ setActiveTab }) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam) setActiveTab(tabParam)
  }, [searchParams, setActiveTab])
  
  return null
}

// Usage with Suspense
<Suspense fallback={null}>
  <TabInitializer setActiveTab={setActiveTab} />
</Suspense>
```

**Used for**:
- Current page/route
- Query parameters
- Tab states
- Filter states
- Shareable URLs

## 🔄 Data Flow Patterns

### Standard Data Fetching Pattern
```typescript
// 1. Component mounts
useEffect(() => {
  fetchData()
}, [])

// 2. User action triggers update
const handleUpdate = async (id, data) => {
  setLoading(true)
  const { error } = await supabase.from('table').update(data).eq('id', id)
  if (!error) {
    await fetchData() // Refresh data
    toast.success('Updated successfully')
  }
  setLoading(false)
}
```

### Real-time Subscription Pattern
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('table-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'table_name' },
      (payload) => {
        // Update local state based on real-time changes
        setData(prevData => updateDataWithPayload(prevData, payload))
      }
    )
    .subscribe()

  return () => subscription.unsubscribe()
}, [])
```

## 🎨 Why This Approach Works

### ✅ Advantages
1. **Simple**: Easy to understand and debug
2. **Performant**: No unnecessary re-renders
3. **Flexible**: Each component manages its own state
4. **Server-First**: Leverages Supabase's real-time capabilities
5. **Type-Safe**: Full TypeScript support
6. **Minimal Bundle**: No additional state management libraries

### 🔧 Key Patterns

#### Error Handling
```typescript
const [error, setError] = useState<string | null>(null)

try {
  // API call
} catch (err) {
  setError(err instanceof Error ? err.message : 'An error occurred')
  toast.error('Operation failed')
}
```

#### Loading States
```typescript
const [loading, setLoading] = useState(false)

const handleAction = async () => {
  setLoading(true)
  try {
    await performAction()
  } finally {
    setLoading(false)
  }
}
```

#### Form State Management
```typescript
const [formData, setFormData] = useState(initialData)
const [hasChanges, setHasChanges] = useState(false)

const handleInputChange = (field: string, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }))
  setHasChanges(true)
}
```

## 🚀 When to Consider Alternative Approaches

You might need Redux/Zustand if you have:
- Complex shared state across many unrelated components
- Frequent state updates causing performance issues
- Complex state logic with many interdependencies
- Time-travel debugging requirements
- Large team needing standardized state patterns

## 🔧 Suspense Usage

### Required for `useSearchParams()`
In Next.js 15, components using `useSearchParams()` must be wrapped in Suspense:

```typescript
// ❌ This will cause build errors
function MyComponent() {
  const searchParams = useSearchParams()
  // ...
}

// ✅ Correct approach
function SearchParamsHandler({ onParamsChange }) {
  const searchParams = useSearchParams()
  // Handle search params
  return null
}

function MyComponent() {
  return (
    <div>
      <Suspense fallback={null}>
        <SearchParamsHandler onParamsChange={handleParamsChange} />
      </Suspense>
      {/* Rest of component */}
    </div>
  )
}
```

### Where We Use Suspense
- Analytics provider (page tracking)
- Components with URL parameter handling
- Any component using `useSearchParams()`

### Where We DON'T Use Suspense
- Data fetching (we use loading states)
- Route transitions (Next.js handles this)
- Most components (only needed for specific hooks)

## 📊 State Management Best Practices

1. **Keep state as local as possible**
2. **Use server state for data that comes from APIs**
3. **Lift state up only when necessary**
4. **Use URL state for shareable/bookmarkable state**
5. **Handle loading and error states consistently**
6. **Use TypeScript for type safety**
7. **Wrap `useSearchParams()` in Suspense boundaries**

This approach provides a clean, maintainable, and performant state management solution that scales well with the application's needs.
