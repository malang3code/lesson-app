import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase 환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 컬럼명 제약 없이 전체 개수만 가볍게 확인하여 DB Keep-Alive 유지
    const { count, error } = await supabase
      .from('lesson_dates')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase Keep-Alive Query Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase ping successful (Keep-Alive)',
      totalLessonDates: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Keep-Alive Endpoint Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}