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
    const { categoryIds } = body

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json({ error: 'Category IDs array is required' }, { status: 400 })
    }

    // Check if any categories have child categories
    const { data: childrenCheck } = await supabase
      .from('categories')
      .select('id, parent_id')
      .in('parent_id', categoryIds)

    if (childrenCheck && childrenCheck.length > 0) {
      const categoriesWithChildren = [...new Set(childrenCheck.map(c => c.parent_id))]
      return NextResponse.json({
        error: `Cannot delete categories with subcategories. ${categoriesWithChildren.length} categories have subcategories. Please delete subcategories first.`
      }, { status: 400 })
    }

    // Check if any categories have questions
    const { data: questionsCheck } = await supabase
      .from('questions')
      .select('category_id')
      .in('category_id', categoryIds)

    if (questionsCheck && questionsCheck.length > 0) {
      const categoriesWithQuestions = [...new Set(questionsCheck.map(q => q.category_id))]
      return NextResponse.json({
        error: `Cannot delete categories with questions. ${categoriesWithQuestions.length} categories have questions. Please move or delete questions first.`
      }, { status: 400 })
    }

    // Delete the categories
    const { error, count } = await supabase
      .from('categories')
      .delete()
      .in('id', categoryIds)

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: count || categoryIds.length 
    })

  } catch (error) {
    console.error('Error bulk deleting categories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
