import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 배정 추가 (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonDate, timeSlotId, memberId, override } = body;

    if (!lessonDate || !timeSlotId || !memberId) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    if (!override) {
      const { data: existing, error: existErr } = await supabaseAdmin
        .from('lessons')
        .select('id')
        .eq('lesson_date', lessonDate)
        .eq('member_id', memberId);

      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: '해당 회원은 이 날짜에 이미 다른 시간대에 배정되어 있습니다.' },
          { status: 400 }
        );
      }
    }

    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('time_slots')
      .select('capacity')
      .eq('id', timeSlotId)
      .single();

    if (slotErr) throw slotErr;

    const { count, error: countErr } = await supabaseAdmin
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_date', lessonDate)
      .eq('time_slot_id', timeSlotId);

    if (countErr) throw countErr;

    if (count !== null && slot && count >= slot.capacity) {
      return NextResponse.json({ error: '해당 시간대의 정원이 마감되었습니다.' }, { status: 400 });
    }

    // 🎯 [is_swap 자동 판별]: 회원의 소속 요일과 배정 날짜의 요일 대조
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('lesson_day')
      .eq('id', memberId)
      .single();

    const [y, m, d] = lessonDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 2: 화요일, 4: 목요일
    const memberDay = member?.lesson_day;

    let isSwap = false;
    if (dow === 2 && memberDay === 'THU') {
      isSwap = true; // 목요일 회원이 화요일에 배정됨
    } else if (dow === 4 && memberDay === 'TUE') {
      isSwap = true; // 화요일 회원이 목요일에 배정됨
    }

    const { data, error } = await supabaseAdmin
      .from('lessons')
      .insert({
        lesson_date: lessonDate,
        time_slot_id: timeSlotId,
        member_id: memberId,
        is_completed: false,
        is_swap: isSwap,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lesson: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 드래그 슬롯 이동 또는 완료 상태 토글 (PATCH)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonId, targetTimeSlotId, lessonDate, isCompleted } = body;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId가 필요합니다.' }, { status: 400 });
    }

    // 1. 레슨 완료(is_completed) 토글 요청인 경우
    if (typeof isCompleted === 'boolean') {
      const { data, error } = await supabaseAdmin
        .from('lessons')
        .update({ is_completed: isCompleted })
        .eq('id', lessonId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, lesson: data });
    }

    // 2. 슬롯 이동 요청인 경우
    if (targetTimeSlotId && lessonDate) {
      const { data: slot, error: slotErr } = await supabaseAdmin
        .from('time_slots')
        .select('capacity')
        .eq('id', targetTimeSlotId)
        .single();

      if (slotErr) throw slotErr;

      const { count, error: countErr } = await supabaseAdmin
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_date', lessonDate)
        .eq('time_slot_id', targetTimeSlotId);

      if (countErr) throw countErr;

      if (count !== null && slot && count >= slot.capacity) {
        return NextResponse.json({ error: '이동하려는 시간대의 정원이 가득 찼습니다.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('lessons')
        .update({ time_slot_id: targetTimeSlotId })
        .eq('id', lessonId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, lesson: data });
    }

    return NextResponse.json({ error: '올바른 수정 파라미터가 아닙니다.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 배정 즉시 삭제 (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const date = searchParams.get('date');

    if (id) {
      const { error } = await supabaseAdmin.from('lessons').delete().eq('id', Number(id));
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    if (date) {
      const { error } = await supabaseAdmin.from('lessons').delete().eq('lesson_date', date);
      if (error) throw error;
      return NextResponse.json({ success: true, date });
    }

    return NextResponse.json({ error: 'id 또는 date 파라미터가 필요합니다.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}