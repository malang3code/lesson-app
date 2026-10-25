import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonDate, assignments, slots } = body as {
      lessonDate: string;
      assignments: {
        timeSlotId: number;
        memberId: number;
        isCompleted?: boolean;
      }[];
      slots?: {
        id: number;
        start_time: string;
      }[];
    };

    if (!lessonDate || !Array.isArray(assignments)) {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다.' }, { status: 400 });
    }

    // 0. 각 슬롯의 변경된 시간 설정이 함께 넘어왔다면 `lesson_date_slots` 업데이트
    if (slots && Array.isArray(slots)) {
      for (const s of slots) {
        const timePart = s.start_time.length === 5 ? s.start_time : s.start_time.slice(0, 5);
        const [h, m] = timePart.split(':').map(Number);
        
        // 30분 뒤 종료 시간 자동 계산 (필요시 조정 가능)
        let endH = h;
        let endM = m + 30;
        if (endM >= 60) {
          endH += 1;
          endM -= 60;
        }
        const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        const { error: slotUpErr } = await supabaseAdmin
          .from('lesson_date_slots')
          .update({
            start_time: timePart,
            end_time: end_time,
          })
          .eq('id', s.id)
          .eq('lesson_date', lessonDate);

        if (slotUpErr) throw slotUpErr;
      }
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