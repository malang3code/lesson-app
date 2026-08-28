import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'date 파라미터가 필요합니다' }, { status: 400 });
  }

  // JS Date는 UTC 기준으로 요일이 밀릴 수 있어 날짜 문자열을 직접 파싱
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();

  const [{ data: slots, error: slotsErr }, { data: lessons, error: lessonsErr }, { data: eligible, error: eligibleErr }] =
    await Promise.all([
      supabaseAdmin
        .from('time_slots')
        .select('id, start_time, end_time, capacity')
        .eq('day_of_week', dow)
        .order('start_time'),
      supabaseAdmin
        .from('lessons')
        .select('id, time_slot_id, member_id, members ( id, name, department, phone )')
        .eq('lesson_date', dateStr),
      supabaseAdmin
        .from('member_lesson_days')
        .select('member_id, members ( id, name, department, phone )')
        .eq('day_of_week', dow),
    ]);

  if (slotsErr || lessonsErr || eligibleErr) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  const assignedMemberIdsToday = new Set((lessons ?? []).map((l) => l.member_id));

  const eligibleMembers = (eligible ?? []).map((row: any) => ({
    id: row.members.id,
    name: row.members.name,
    department: row.members.department,
    phone: row.members.phone,
    alreadyAssignedToday: assignedMemberIdsToday.has(row.members.id),
  }));

  const slotsWithLessons = (slots ?? []).map((slot) => ({
    ...slot,
    assigned: (lessons ?? [])
      .filter((l) => l.time_slot_id === slot.id)
      .map((l: any) => ({
        lessonId: l.id,
        memberId: l.member_id,
        name: l.members.name,
        department: l.members.department,
        phone: l.members.phone,
      })),
  }));

  return NextResponse.json({
    dayOfWeek: dow,
    slots: slotsWithLessons,
    eligibleMembers,
  });
}