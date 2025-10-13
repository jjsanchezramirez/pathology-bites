import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    const body = await request.json()
    const { categoryIds, parentId } = body

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json({ error: 'Category IDs array is required' }, { status: 400 })
    }

    // If parentId is provided, validate it exists and prevent circular references
    if (parentId) {
      // Check if parent exists
      const { data: parentCategory, error: parentError } = await supabase
        .from('categories')
        .select('id, level')
        .eq('id', parentId)
        .single()

      if (parentError || !parentCategory) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 })
      }

      // Check for circular references - prevent assigning a category as parent of itself or its descendants
      if (categoryIds.includes(parentId)) {
        return NextResponse.json({ error: 'Cannot assign a category as its own parent' }, { status: 400 })
      }

      // Get all descendants of the categories being updated to prevent circular references
      const getAllDescendants = async (categoryIds: string[]): Promise<string[]> => {
        const { data: children } = await supabase
          .from('categories')
          .select('id')
          .in('parent_id', categoryIds)

        if (!children || children.length === 0) {
          return []
        }

        const childIds = children.map(c => c.id)
        const grandChildren = await getAllDescendants(childIds)
        return [...childIds, ...grandChildren]
      }

      const allDescendants = await getAllDescendants(categoryIds)
      if (allDescendants.includes(parentId)) {
        return NextResponse.json({ 
          error: 'Cannot create circular reference - the selected parent is a descendant of one of the categories being updated' 
        }, { status: 400 })
      }
    }

    // Calculate new level based on parent
    let newLevel = 1
    if (parentId) {
      const { data: parentData } = await supabase
        .from('categories')
        .select('level')
        .eq('id', parentId)
        .single()

      if (parentData) {
        newLevel = parentData.level + 1
      }
    }

    // Update the categories
    const { error, count } = await supabase
      .from('categories')
      .update({
        parent_id: parentId || null,
        level: newLevel
      })
      .in('id', categoryIds)

    if (error) {
      throw error
    }

    // Update levels of all descendants recursively
    const updateDescendantLevels = async (parentIds: string[], baseLevel: number) => {
      const { data: children } = await supabase
        .from('categories')
        .select('id')
        .in('parent_id', parentIds)

      if (children && children.length > 0) {
        const childIds = children.map(c => c.id)
        
        await supabase
          .from('categories')
          .update({ level: baseLevel + 1 })
          .in('id', childIds)

        // Recursively update grandchildren
        await updateDescendantLevels(childIds, baseLevel + 1)
      }
    }

    // Update descendant levels
    await updateDescendantLevels(categoryIds, newLevel)

    return NextResponse.json({ 
      success: true, 
      updatedCount: count || categoryIds.length 
    })

  } catch (error) {
    console.error('Error bulk assigning parent categories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
