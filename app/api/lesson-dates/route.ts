import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/lesson-dates — 등록된 전체 레슨일 오름차순 반환
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('lesson_dates')
    .select('lesson_date')
    .order('lesson_date');

  if (error) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  return NextResponse.json({ dates: (data ?? []).map((r) => r.lesson_date) });
}