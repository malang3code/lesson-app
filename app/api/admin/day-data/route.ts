import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

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

  const year2 = empNo.slice(2, 4);
  const sameYearMembers = sameNameMembers.filter(
    (m) => (m.employee_no || '').slice(2, 4) === year2
  );

  if (sameYearMembers.length > 1) {
    const last4 = empNo.slice(-4);
    return `${member.name}${year2}(${last4})`;
  }

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
    const dow = new Date(y, m - 1, d).getDay(); // 2: 화요일, 4: 목요일

    // 1. 해당 날짜가 속한 기수(term_month) 판별
    let targetTermMonth = date.slice(0, 7); 

    const { data: dateInfo, error: dErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('term_month')
      .eq('lesson_date', date)
      .maybeSingle();

    if (!dErr && dateInfo && dateInfo.term_month) {
      targetTermMonth = dateInfo.term_month;
    }

    // 2. 해당 기수의 term_members 목록 조회 (employee_no와 lesson_day)
    const { data: termMembers, error: tmErr } = await supabaseAdmin
      .from('term_members')
      .select('employee_no, lesson_day')
      .eq('term_month', targetTermMonth);

    if (tmErr) throw tmErr;

    const employeeNos = (termMembers ?? []).map((tm) => tm.employee_no).filter(Boolean);

    // 3. members 마스터에서 해당 사번들의 회원 정보 조회
    let activeMembers: any[] = [];
    if (employeeNos.length > 0) {
      const { data: mems, error: mErr } = await supabaseAdmin
        .from('members')
        .select('id, name, department, phone, employee_no')
        .in('employee_no', employeeNos);

      if (mErr) throw mErr;

      // term_members의 요일 정보와 members의 인적사항을 employee_no 기준으로 결합
      activeMembers = (mems ?? []).map((m) => {
        const tm = termMembers.find((t) => t.employee_no === m.employee_no);
        return {
          ...m,
          lesson_day: (tm?.lesson_day || 'TUE') as 'TUE' | 'THU' | 'BOTH',
        };
      });
    }

    // 4. 해당 요일 시간대 슬롯 조회
    const { data: slots, error: sErr } = await supabaseAdmin
      .from('time_slots')
      .select('id, start_time, end_time, capacity')
      .eq('day_of_week', dow)
      .order('start_time');

    if (sErr) throw sErr;

    // 5. 해당 날짜 배정 데이터 조회
    const { data: lessons, error: lErr } = await supabaseAdmin
      .from('lessons')
      .select('id, member_id, time_slot_id, is_completed')
      .eq('lesson_date', date)
      .order('id');

    if (lErr) throw lErr;

    // 동명이인 그룹화 맵
    const nameMap = new Map<string, typeof activeMembers>();
    activeMembers.forEach((m) => {
      const list = nameMap.get(m.name) || [];
      list.push(m);
      nameMap.set(m.name, list);
    });

    const assignedMemberIdSet = new Set((lessons ?? []).map((l) => l.member_id));

    // 6. 화요일/목요일 요일별 수강생 필터링 규칙 적용
    const isTuesday = dow === 2;
    const isThursday = dow === 4;

    const filteredMembers = activeMembers.filter((m) => {
      if (isTuesday) return m.lesson_day === 'TUE' || m.lesson_day === 'BOTH';
      if (isThursday) return m.lesson_day === 'THU' || m.lesson_day === 'BOTH';
      return true;
    });

    // 배정 가능한 회원 목록 생성
    const eligibleMembers = filteredMembers.map((m) => {
      const sameNames = nameMap.get(m.name) || [];
      const dispName = buildDisplayName(m, sameNames);
      return {
        id: m.id,
        name: dispName,
        rawName: m.name,
        department: m.department,
        phone: m.phone,
        employee_no: m.employee_no,
        lesson_day: m.lesson_day,
        alreadyAssignedToday: assignedMemberIdSet.has(m.id),
      };
    });

    // 7. 시간대별 배정 목록 매핑
    const formattedSlots = (slots ?? []).map((slot) => {
      const slotLessons = (lessons ?? []).filter((l) => l.time_slot_id === slot.id);
      return {
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        assigned: slotLessons.map((l) => {
          const mem = activeMembers.find((am) => am.id === l.member_id);
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
    console.error("🔥 /api/admin/day-data ERROR:", err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}