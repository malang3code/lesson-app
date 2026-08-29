import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonDate, assignments } = body as {
      lessonDate: string;
      assignments: {
        timeSlotId: number;
        memberId: number;
        isCompleted?: boolean;
      }[];
    };

    if (!lessonDate || !Array.isArray(assignments)) {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다.' }, { status: 400 });
    }

    // 1. 해당 날짜의 기존 배정 내역 전체 삭제
    const { error: delErr } = await supabaseAdmin
      .from('lessons')
      .delete()
      .eq('lesson_date', lessonDate);

    if (delErr) throw delErr;

    // 2. 새로운 배정 내역이 있으면 한 번에 Bulk Insert
    if (assignments.length > 0) {
      const insertRows = assignments.map((a) => ({
        lesson_date: lessonDate,
        time_slot_id: a.timeSlotId,
        member_id: a.memberId,
        is_completed: !!a.isCompleted,
      }));

      const { error: insErr } = await supabaseAdmin
        .from('lessons')
        .insert(insertRows);

      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true, count: assignments.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}