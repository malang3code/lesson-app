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

// 🎯 기본 6개 슬롯 생성 헬퍼 (19:00부터 30분 간격 6개)
async function getOrCreateDaySlots(date: string) {
  // 1. 해당 날짜의 슬롯 조회
  const { data: existingSlots, error: fetchErr } = await supabaseAdmin
    .from('lesson_date_slots')
    .select('id, slot_index, start_time, end_time, capacity')
    .eq('lesson_date', date)
    .order('slot_index');

  if (!fetchErr && existingSlots && existingSlots.length > 0) {
    return existingSlots;
  }

  // 2. 없으면 기본 6개 슬롯 생성 (예: 19:00, 19:30, 20:00, 20:30, 21:00, 21:30)
  const defaultTimes = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
  const defaultSlotsToInsert = defaultTimes.map((start, idx) => {
    // 30분 뒤 종료 시간 계산
    const [h, m] = start.split(':').map(Number);
    let endH = h;
    let endM = m + 30;
    if (endM >= 60) {
      endH += 1;
      endM -= 60;
    }
    const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    return {
      lesson_date: date,
      slot_index: idx + 1,
      start_time: start,
      end_time: end,
      capacity: 2, // 기본 정원
    };
  });

  const { data: insertedSlots, error: insertErr } = await supabaseAdmin
    .from('lesson_date_slots')
    .insert(defaultSlotsToInsert)
    .select('id, slot_index, start_time, end_time, capacity')
    .order('slot_index');

  if (insertErr || !insertedSlots) {
    console.error('🔥 기본 슬롯 생성 실패:', insertErr);
    return [];
  }

  return insertedSlots;
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

    // 2. 해당 기수의 term_members 목록 조회
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

      activeMembers = (mems ?? []).map((m) => {
        const tm = termMembers.find((t) => t.employee_no === m.employee_no);
        return {
          ...m,
          lesson_day: (tm?.lesson_day || 'TUE') as 'TUE' | 'THU' | 'BOTH',
        };
      });
    }

    // 🎯 4. 해당 날짜의 커스텀 6개 슬롯 시간 가져오기 (없으면 자동 생성)
    const slots = await getOrCreateDaySlots(date);

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

    // 6. 요일별 기본 필터링 명단과 기수 전체 명단 각각 생성
    const isTuesday = dow === 2;
    const isThursday = dow === 4;

    const filteredMembers = activeMembers.filter((m) => {
      if (isTuesday) return m.lesson_day === 'TUE' || m.lesson_day === 'BOTH';
      if (isThursday) return m.lesson_day === 'THU' || m.lesson_day === 'BOTH';
      return true;
    });

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

    const allEligibleMembers = activeMembers.map((m) => {
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
    const formattedSlots = slots.map((slot) => {
      const slotLessons = (lessons ?? []).filter((l) => l.time_slot_id === slot.id);
      return {
        id: slot.id,
        slot_index: slot.slot_index, // 🎯 1~6번 칸 번호 전달
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
      allEligibleMembers,
    });
  } catch (err: unknown) {
    console.error("🔥 /api/admin/day-data ERROR:", err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}