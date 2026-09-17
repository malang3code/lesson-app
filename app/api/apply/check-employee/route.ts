import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employee_no } = body;

    if (!employee_no || typeof employee_no !== 'string') {
      return NextResponse.json({ error: '사번을 입력해 주세요.' }, { status: 400 });
    }

    // members 테이블에서 사번 조회 (컬럼명: employee_no)
    const { data: member, error } = await supabaseAdmin
      .from('members')
      .select('id, employee_no, name, department, phone')
      .eq('employee_no', employee_no.trim())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (member) {
      // 기존 회원: 인적사항 전달
      return NextResponse.json({
        exists: true,
        member: {
          name: member.name,
          department: member.department,
          phone: member.phone,
        },
      });
    }

    // 신규 회원: 기본 인적사항 입력 필요
    return NextResponse.json({
      exists: false,
      member: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}