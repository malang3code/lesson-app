import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

// 1. 특정 기수의 수강생 목록 조회 (GET)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term') || '2026-09'; // 기본값 또는 전달된 기수

    // 1) term_members에서 해당 기수 명단 조회
    const { data: termMembers, error: tmErr } = await supabaseAdmin
      .from('term_members')
      .select('*')
      .eq('term_month', term);

    if (tmErr) throw tmErr;

    if (!termMembers || termMembers.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const employeeNos = termMembers.map((tm) => tm.employee_no).filter(Boolean);

    // 2) members 마스터에서 인적사항 조회
    const { data: masterMems, error: mErr } = await supabaseAdmin
      .from('members')
      .select('*')
      .in('employee_no', employeeNos);

    if (mErr) throw mErr;

    // 3) 결합
    const members = termMembers.map((tm) => {
      const master = (masterMems || []).find((m) => m.employee_no === tm.employee_no);
      return {
        id: tm.id, // term_members의 id 또는 회원 고유값
        employee_no: tm.employee_no,
        name: master?.name || '이름 없음',
        department: master?.department || null,
        phone: master?.phone || null,
        lesson_day: tm.lesson_day || 'TUE',
        is_active: true,
      };
    });

    return NextResponse.json({ members });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 2. 기수별 수강생 등록 (POST) - 마스터에 없으면 등록 후 term_members에 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_no, name, department, phone, lesson_day, term = '2026-09' } = body;

    if (!name?.trim() || !employee_no?.trim()) {
      return NextResponse.json({ error: '사번과 이름은 필수 항목입니다.' }, { status: 400 });
    }

    const cleanEmpNo = employee_no.replace(/[^0-9]/g, '');

    // 1) members 마스터에 사번이 없으면 자동 등록
    const { data: existingMaster } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('employee_no', cleanEmpNo)
      .maybeSingle();

    if (!existingMaster) {
      await supabaseAdmin.from('members').insert({
        employee_no: cleanEmpNo,
        name: name.trim(),
        department: department?.trim() || null,
        phone: phone?.replace(/[^0-9]/g, '') || null,
      });
    } else {
      // 마스터 정보 업데이트
      await supabaseAdmin
        .from('members')
        .update({
          name: name.trim(),
          department: department?.trim() || null,
          phone: phone?.replace(/[^0-9]/g, '') || null,
        })
        .eq('employee_no', cleanEmpNo);
    }

    // 2) term_members에 해당 기수 요일 정보 upsert
    const { error: tmErr } = await supabaseAdmin
      .from('term_members')
      .upsert(
        {
          term_month: term,
          employee_no: cleanEmpNo,
          lesson_day: lesson_day || 'TUE',
        },
        { onConflict: 'term_month,employee_no' }
      );

    if (tmErr) throw tmErr;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 3. 기수별 수강생 삭제 (DELETE) - term_members에서 제거
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeNo = searchParams.get('employee_no');
    const term = searchParams.get('term') || '2026-09';

    if (!employeeNo) {
      return NextResponse.json({ error: '사번이 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('term_members')
      .delete()
      .eq('term_month', term)
      .eq('employee_no', employeeNo);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}