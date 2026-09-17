import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // lesson_dates에 등록된 기수(term_month) 목록 조회
    const { data, error } = await supabaseAdmin
      .from('lesson_dates')
      .select('term_month')
      .not('term_month', 'is', null)
      .order('term_month', { ascending: false });

    if (error) throw error;

    // 중복 제거 및 최신순 정렬
    const termSet = new Set<string>();
    (data ?? []).forEach((row: { term_month: string }) => {
      if (row.term_month) termSet.add(row.term_month);
    });

    const terms = Array.from(termSet).sort().reverse();

    return NextResponse.json({ terms });
  } catch (err: any) {
    console.error('[Fetch Terms Error]:', err);
    return NextResponse.json({ error: err.message || '기수 목록 조회 실패' }, { status: 500 });
  }
}