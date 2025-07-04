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

    const { questionImages } = await request.json();

    if (!questionImages || !Array.isArray(questionImages)) {
      return NextResponse.json(
        { error: 'Invalid question images data' },
        { status: 400 }
      );
    }

    // Debug: Log the received data
    console.log('Received question images data:', JSON.stringify(questionImages, null, 2));

    // Insert question images
    const { data, error } = await supabase
      .from('question_images')
      .insert(questionImages)
      .select();

    if (error) {
      console.error('Error creating question images:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in question-images API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
