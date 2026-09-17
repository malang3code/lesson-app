import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface StatusChangeItem {
  id: number;
  status: 'ON' | 'OFF';
  lesson_day: 'TUE' | 'THU' | 'BOTH';
}

export async function POST(req: Request) {
  try {
    const { updates } = (await req.json()) as { updates: StatusChangeItem[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 });
    }

    const applicationIds = updates.map((u) => u.id);

    // 1. 대상 신청서 정보 조회
    const { data: applications, error: fetchError } = await supabaseAdmin
      .from('lesson_applications')
      .select('*')
      .in('id', applicationIds);

    if (fetchError || !applications) {
      throw new Error(fetchError?.message || '신청서 조회 실패');
    }

    const updateMap = new Map<number, { status: 'ON' | 'OFF'; lesson_day: 'TUE' | 'THU' | 'BOTH' }>();
    updates.forEach((u) => updateMap.set(u.id, { status: u.status, lesson_day: u.lesson_day }));

    // 2. 항목별 순회하며 동기화 처리
    for (const app of applications) {
      const updateInfo = updateMap.get(app.id);
      if (!updateInfo) continue;

      const nextStatus = updateInfo.status;
      const assignedLessonDay = updateInfo.lesson_day;

      if (nextStatus === 'ON') {
        // [ON 승인 처리]
        // ① members 마스터 동기화 (없으면 생성, 있으면 인적사항 정보 갱신)
        const { data: memberData } = await supabaseAdmin
          .from('members')
          .select('id')
          .eq('employee_no', app.employee_no)
          .maybeSingle();

        let memberId = memberData?.id;

        if (memberId) {
          await supabaseAdmin
            .from('members')
            .update({
              name: app.name,
              department: app.department,
              phone: app.phone,
            })
            .eq('id', memberId);
        } else {
          const { data: newMember, error: insertMemError } = await supabaseAdmin
            .from('members')
            .insert({
              employee_no: app.employee_no,
              name: app.name,
              department: app.department,
              phone: app.phone,
            })
            .select('id')
            .single();

          if (insertMemError) {
            console.error('[Batch Insert Member Error]:', insertMemError);
            continue;
          }
          memberId = newMember.id;
        }

        // ② term_members 기수별 확정 명단 연동 (확정 요일 저장)
        if (memberId) {
          const { data: existingTermMember } = await supabaseAdmin
            .from('term_members')
            .select('id')
            .eq('term_month', app.term_month)
            .eq('employee_no', app.employee_no)
            .maybeSingle();

          if (existingTermMember) {
            await supabaseAdmin
              .from('term_members')
              .update({
                lesson_day: assignedLessonDay,
              })
              .eq('id', existingTermMember.id);
          } else {
            await supabaseAdmin.from('term_members').insert({
              term_month: app.term_month,
              employee_no: app.employee_no,
              lesson_day: assignedLessonDay,
            });
          }
        }
      } else {
        // [OFF 취소 처리]
        // ① 해당 기수와 사번으로 등록된 term_members 확정 내역 삭제
        await supabaseAdmin
          .from('term_members')
          .delete()
          .eq('term_month', app.term_month)
          .eq('employee_no', app.employee_no);

        // ② 다른 기수 참여 이력이 있는지 안전하게 확인 후 없으면 members 마스터에서 삭제
        const { count: otherTermCount } = await supabaseAdmin
          .from('term_members')
          .select('*', { count: 'exact', head: true })
          .eq('employee_no', app.employee_no);

        if ((otherTermCount ?? 0) === 0) {
          const { error: deleteMemberError } = await supabaseAdmin
            .from('members')
            .delete()
            .eq('employee_no', app.employee_no);

          if (deleteMemberError) {
            console.error('[Batch Delete Member Error]:', deleteMemberError);
          }
        }
      }

      // ③ lesson_applications 상태 반영
      await supabaseAdmin
        .from('lesson_applications')
        .update({ 
          status: nextStatus
        })
        .eq('id', app.id);
    }

    return NextResponse.json({ success: true, count: updates.length });
  } catch (err: any) {
    console.error('[Batch Save Error]:', err);
    return NextResponse.json({ error: err.message || '일괄 저장 실패' }, { status: 500 });
  }
}