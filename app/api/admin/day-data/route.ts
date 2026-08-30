import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function buildDisplayName(
  member: { id: number; name: string; employee_no: string | null },
  sameNameMembers: { id: number; name: string; employee_no: string | null }[]
): string {
  if (sameNameMembers.length <= 1) {
    return member.name;
  }

  const empNo = member.employee_no || '';
  if (empNo.length !== 8) {
    return `${member.name}(${member.id})`;
  }

  const year2 = empNo.slice(2, 4); // 예: '20150230' -> '15'
  const sameYearMembers = sameNameMembers.filter(
    (m) => (m.employee_no || '').slice(2, 4) === year2
  );

  // 입사연도까지 같으면 끝 4자리 붙임: 예) 김태영15(0230)
  if (sameYearMembers.length > 1) {
    const last4 = empNo.slice(-4);
    return `${member.name}${year2}(${last4})`;
  }

  // 입사연도가 다르면 연도 2자리만 붙임: 예) 김태영15
  return `${member.name}${year2}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: '날짜가 필요합니다.' }, { status: 400 });
    }

    const [y, m, d] = date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();

    // 1. 활성 회원 목록 조회 (lesson_day 포함)
    const { data: members, error: mErr } = await supabaseAdmin
      .from('members')
      .select('id, name, department, phone, employee_no, is_active, lesson_day')
      .eq('is_active', true)
      .order('name');

    if (mErr) throw mErr;

    // 2. 해당 요일 시간대 슬롯 조회
    const { data: slots, error: sErr } = await supabaseAdmin
      .from('time_slots')
      .select('id, start_time, end_time, capacity')
      .eq('day_of_week', dow)
      .order('start_time');

    if (sErr) throw sErr;

    // 3. 해당 날짜 배정 데이터 조회
    const { data: lessons, error: lErr } = await supabaseAdmin
      .from('lessons')
      .select('id, member_id, time_slot_id, is_completed, members(id, name, department, phone, employee_no, lesson_day)')
      .eq('lesson_date', date)
      .order('id');

    if (lErr) throw lErr;

    const allActiveMembers = members ?? [];

    // 동명이인 그룹화 맵
    const nameMap = new Map<string, typeof allActiveMembers>();
    allActiveMembers.forEach((m) => {
      const list = nameMap.get(m.name) || [];
      list.push(m);
      nameMap.set(m.name, list);
    });

    const assignedMemberIdSet = new Set((lessons ?? []).map((l) => l.member_id));

    // 배정 가능한 회원 목록 생성 (동명이인 처리 & lesson_day 포함)
    const eligibleMembers = allActiveMembers.map((m) => {
      const sameNames = nameMap.get(m.name) || [];
      const dispName = buildDisplayName(m, sameNames);
      return {
        id: m.id,
        name: dispName,
        rawName: m.name,
        department: m.department,
        phone: m.phone,
        employee_no: m.employee_no,
        lesson_day: (m.lesson_day || 'TUE') as 'TUE' | 'THU' | 'BOTH',
        alreadyAssignedToday: assignedMemberIdSet.has(m.id),
      };
    });

    // 시간대별 배정 목록 매핑
    const formattedSlots = (slots ?? []).map((slot) => {
      const slotLessons = (lessons ?? []).filter((l) => l.time_slot_id === slot.id);
      return {
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        assigned: slotLessons.map((l) => {
          const mem = l.members as unknown as {
            id: number;
            name: string;
            department: string | null;
            phone: string | null;
            employee_no: string | null;
            lesson_day: string | null;
          };
          const sameNames = nameMap.get(mem?.name || '') || [];
          const dispName = mem ? buildDisplayName(mem, sameNames) : '알 수 없음';

          return {
            lessonId: l.id,
            memberId: l.member_id,
            name: dispName,
            department: mem?.department ?? null,
            phone: mem?.phone ?? null,
            lesson_day: (mem?.lesson_day || 'TUE') as 'TUE' | 'THU' | 'BOTH',
            isCompleted: !!l.is_completed,
          };
        }),
      };
    });

    return NextResponse.json({
      slots: formattedSlots,
      eligibleMembers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}