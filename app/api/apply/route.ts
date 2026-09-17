import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      employee_no,
      name,
      department,
      phone,
      preferred_day,
      preferred_time_1,
      preferred_time_2,
      notes,
    } = body;

    // 1. 현재 모집 설정 확인 (term_month 컬럼 명시적 조회)
    const { data: setting, error: settingError } = await supabaseAdmin
      .from('recruitment_settings')
      .select('is_open, term_month')
      .eq('id', 1)
      .single();

    if (settingError || !setting) {
      return NextResponse.json({ error: '모집 설정을 불러올 수 없습니다.' }, { status: 500 });
    }

    if (!setting.is_open) {
      return NextResponse.json({ error: '현재는 레슨 수강 신청 기간이 아닙니다.' }, { status: 400 });
    }

    // 🎯 널 제약조건 방어: 모집 설정에 기수가 지정되어 있는지 확인
    const currentTerm = setting.term_month;
    if (!currentTerm) {
      return NextResponse.json({ error: '현재 모 집에 설정된 기수 정보가 없습니다. 관리자에게 문의하세요.' }, { status: 400 });
    }

    // 2. 사번 숫자 8자리 검증
    const trimmedEmpNo = (employee_no || '').trim().replace(/[^0-9]/g, '');
    if (!trimmedEmpNo || !/^\d{8}$/.test(trimmedEmpNo)) {
      return NextResponse.json({ error: '사번은 숫자 8자리여야 합니다.' }, { status: 400 });
    }

    if (!preferred_day || !['TUE_ONLY', 'THU_ONLY', 'ANY'].includes(preferred_day)) {
      return NextResponse.json({ error: '희망 요일을 올바르게 선택해 주세요.' }, { status: 400 });
    }

    // 3. 해당 기수 중복 신청 검증
    const { data: duplicateApps, error: dupCheckError } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('term_month', currentTerm)
      .eq('employee_no', trimmedEmpNo)
      .limit(1);

    if (dupCheckError) {
      return NextResponse.json({ error: dupCheckError.message }, { status: 500 });
    }

    if (duplicateApps && duplicateApps.length > 0) {
      return NextResponse.json(
        { error: '이미 신청하셨습니다. 새로 신청하고 싶다면 관리자에게 문의하세요.' },
        { status: 409 }
      );
    }

    // 4. 기존 회원 마스터 대조
    const { data: members, error: memberError } = await supabaseAdmin
      .from('members')
      .select('name, department, phone')
      .eq('employee_no', trimmedEmpNo)
      .limit(1);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const existingMember = members && members.length > 0 ? members[0] : null;

    let finalName = '';
    let finalDepartment = '';
    let finalPhone = '';

    if (existingMember) {
      finalName = name?.trim() || existingMember.name;
      finalDepartment = department?.trim() || existingMember.department || '';
      finalPhone = (phone || existingMember.phone || '').replace(/[^0-9]/g, '');
    } else {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: '최초 신청자는 이름을 필수로 입력해야 합니다.' }, { status: 400 });
      }
      if (!department || !department.trim()) {
        return NextResponse.json({ error: '최초 신청자는 부서를 필수로 입력해야 합니다.' }, { status: 400 });
      }

      finalPhone = (phone || '').trim().replace(/[^0-9]/g, '');
      if (!finalPhone || !/^\d{11}$/.test(finalPhone)) {
        return NextResponse.json({ error: '전화번호는 숫자 11자리여야 합니다.' }, { status: 400 });
      }

      finalName = name.trim();
      finalDepartment = department.trim();
    }

    // 5. 신청서 테이블에 term_month와 함께 저장
    const { data: application, error: insertError } = await supabaseAdmin
      .from('lesson_applications')
      .insert({
        term_month: currentTerm,
        employee_no: trimmedEmpNo,
        name: finalName,
        department: finalDepartment,
        phone: finalPhone,
        preferred_day,
        preferred_time_1: preferred_time_1?.trim() || null,
        preferred_time_2: preferred_time_2?.trim() || null,
        notes: notes?.trim() || null,
        status: 'OFF',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: `저장 실패: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${finalName}님의 [${currentTerm}] 수강 신청이 정상 접수되었습니다.`,
      application,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}