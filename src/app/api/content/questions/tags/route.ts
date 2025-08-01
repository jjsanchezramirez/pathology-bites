import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or creator
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'creator'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Creator access required' }, { status: 403 });
    }

    const { questionTags } = await request.json();

    if (!questionTags || !Array.isArray(questionTags)) {
      return NextResponse.json(
        { error: 'Invalid question tags data' },
        { status: 400 }
      );
    }

    // Insert question tags
    const { data, error } = await supabase
      .from('question_tags')
      .insert(questionTags);

    if (error) {
      console.error('Error creating question tags:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in question-tags API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
