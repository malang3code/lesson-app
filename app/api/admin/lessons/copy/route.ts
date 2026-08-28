import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/admin/lessons/copy  { fromDate, toDates: string[] }
export async function POST(req: Request) {
  const { fromDate, toDates } = await req.json();

  if (!fromDate || !Array.isArray(toDates) || toDates.length === 0) {
    return NextResponse.json({ error: 'fromDate, toDates가 필요합니다' }, { status: 400 });
  }

  const { data: sourceLessons, error: sourceErr } = await supabaseAdmin
    .from('lessons')
    .select('time_slot_id, member_id')
    .eq('lesson_date', fromDate);

  if (sourceErr) {
    return NextResponse.json({ error: '원본 조회 실패' }, { status: 500 });
  }

  if (!sourceLessons || sourceLessons.length === 0) {
    return NextResponse.json({ error: '복사할 배정이 없습니다' }, { status: 400 });
  }

  const summary: Record<string, { copied: number; skipped: number }> = {};

  for (const toDate of toDates) {
    // 대상 날짜가 등록된 레슨일인지 확인
    const { data: dateExists } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date')
      .eq('lesson_date', toDate)
      .maybeSingle();

    if (!dateExists) {
      summary[toDate] = { copied: 0, skipped: sourceLessons.length };
      continue;
    }

    let copied = 0;
    let skipped = 0;

    for (const lesson of sourceLessons) {
      // 슬롯 정원 확인
      const { data: slot } = await supabaseAdmin
        .from('time_slots')
        .select('capacity')
        .eq('id', lesson.time_slot_id)
        .single();

      const { count } = await supabaseAdmin
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_date', toDate)
        .eq('time_slot_id', lesson.time_slot_id);

      if (!slot || (count ?? 0) >= slot.capacity) {
        skipped++;
        continue;
      }

      const { error: insertErr } = await supabaseAdmin.from('lessons').insert({
        lesson_date: toDate,
        time_slot_id: lesson.time_slot_id,
        member_id: lesson.member_id,
      });

      if (insertErr) {
        // 이미 같은 배정이 있는 경우(unique 제약) 등은 건너뜀
        skipped++;
      } else {
        copied++;
      }
    }

    summary[toDate] = { copied, skipped };
  }

  return NextResponse.json({ success: true, summary });
}