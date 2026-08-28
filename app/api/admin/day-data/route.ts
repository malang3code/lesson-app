import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'date query parameter is required' }, { status: 400 });
  }

  try {
    const [y, m, d] = date.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    // 1. 해당 요일의 시간표 슬롯 조회
    const { data: slots, error: slotsErr } = await supabase
      .from('time_slots')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .order('start_time');

    if (slotsErr) throw slotsErr;

    // 2. 해당 날짜에 이미 배정된 레슨 내역 조회 (과거/비활성 회원도 정상 표시)
    const { data: lessons, error: lessonsErr } = await supabase
      .from('lessons')
      .select('id, time_slot_id, member_id, members(id, name, department, phone)')
      .eq('lesson_date', date);

    if (lessonsErr) throw lessonsErr;

    // 3. 신규 배정 대상 회원 목록: is_active = true 인 회원만 조회
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('id, name, department, phone')
      .eq('is_active', true)
      .order('name');

    if (membersErr) throw membersErr;

    const assignedMemberIds = new Set((lessons ?? []).map((l) => l.member_id));

    const eligibleMembers = (members ?? []).map((m) => ({
      ...m,
      alreadyAssignedToday: assignedMemberIds.has(m.id),
    }));

    const slotMap = (slots ?? []).map((slot) => {
      const assigned = (lessons ?? [])
        .filter((l) => l.time_slot_id === slot.id)
        .map((l) => {
          const m = Array.isArray(l.members) ? l.members[0] : l.members;
          return {
            lessonId: l.id,
            memberId: l.member_id,
            name: m?.name ?? '알 수 없음',
            department: m?.department ?? null,
            phone: m?.phone ?? null,
          };
        });

      return {
        ...slot,
        assigned,
      };
    });

    return NextResponse.json({
      date,
      slots: slotMap,
      eligibleMembers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}