import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const { lessonDate, timeSlotId, memberId, override } = await req.json();

  if (!lessonDate || !timeSlotId || !memberId) {
    return NextResponse.json({ error: '필수 값이 누락되었습니다' }, { status: 400 });
  }

  const { data: slot, error: slotErr } = await supabaseAdmin
    .from('time_slots')
    .select('capacity')
    .eq('id', timeSlotId)
    .single();

  if (slotErr || !slot) {
    return NextResponse.json({ error: '시간대를 찾을 수 없습니다' }, { status: 404 });
  }

  const { count, error: countErr } = await supabaseAdmin
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_date', lessonDate)
    .eq('time_slot_id', timeSlotId);

  if (countErr) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  if ((count ?? 0) >= slot.capacity) {
    return NextResponse.json({ error: '해당 슬롯 정원이 가득 찼습니다' }, { status: 409 });
  }

  const { data: sameDayLessons, error: sameDayErr } = await supabaseAdmin
    .from('lessons')
    .select('id')
    .eq('lesson_date', lessonDate)
    .eq('member_id', memberId);

  if (sameDayErr) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  if ((sameDayLessons?.length ?? 0) > 0 && !override) {
    return NextResponse.json(
      { error: '이미 같은 날 배정된 회원입니다. 예외 처리가 필요합니다.' },
      { status: 409 }
    );
  }

  const { error: insertErr } = await supabaseAdmin.from('lessons').insert({
    lesson_date: lessonDate,
    time_slot_id: timeSlotId,
    member_id: memberId,
    is_duplicate_override: (sameDayLessons?.length ?? 0) > 0,
  });

  if (insertErr) {
    return NextResponse.json({ error: '배정 실패: ' + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get('id');
  const date = searchParams.get('date');

  if (lessonId) {
    const { error } = await supabaseAdmin.from('lessons').delete().eq('id', lessonId);
    if (error) {
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (date) {
    const { error } = await supabaseAdmin.from('lessons').delete().eq('lesson_date', date);
    if (error) {
      return NextResponse.json({ error: '전체 삭제 실패' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'id 또는 date 파라미터가 필요합니다' }, { status: 400 });
}