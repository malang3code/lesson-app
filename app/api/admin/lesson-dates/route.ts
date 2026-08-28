import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 파라미터가 필요합니다' }, { status: 400 });
  }

  const monthStr = month.padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('lesson_dates')
    .select('lesson_date')
    .gte('lesson_date', startDate)
    .lte('lesson_date', endDate)
    .order('lesson_date');

  if (error) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  return NextResponse.json({ dates: (data ?? []).map((r) => r.lesson_date) });
}

export async function POST(req: Request) {
  const { date } = await req.json();
  if (!date) {
    return NextResponse.json({ error: 'date가 필요합니다' }, { status: 400 });
  }

  const dow = new Date(date + 'T00:00:00').getDay();
  if (dow !== 2 && dow !== 4) {
    return NextResponse.json({ error: '화요일/목요일만 지정할 수 있습니다' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('lesson_dates')
    .select('lesson_date')
    .eq('lesson_date', date)
    .maybeSingle();

  if (existing) {
    const { count } = await supabaseAdmin
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('lesson_date', date);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: '이미 배정된 레슨이 있어 해제할 수 없습니다. 먼저 배정을 삭제하세요.' },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from('lesson_dates').delete().eq('lesson_date', date);
    if (error) return NextResponse.json({ error: '해제 실패' }, { status: 500 });
    return NextResponse.json({ success: true, active: false });
  } else {
    const { error } = await supabaseAdmin.from('lesson_dates').insert({ lesson_date: date });
    if (error) return NextResponse.json({ error: '등록 실패' }, { status: 500 });
    return NextResponse.json({ success: true, active: true });
  }
}