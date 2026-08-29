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

    // Supabase가 잠들지 않도록 가벼운 1건 쿼리 실행
    const { error } = await supabase
      .from('lesson_dates')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase Keep-Alive Query Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase ping successful (Keep-Alive)',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Keep-Alive Endpoint Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}