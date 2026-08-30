import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 1. 회원 목록 조회 (GET)
export async function GET() {
  try {
    const { data: members, error } = await supabase
      .from('members')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. 신규 회원 등록 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employee_no, name, department, phone, lesson_day, is_active } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          employee_no: employee_no ? employee_no.trim() : `EMP-${Date.now()}`,
          name: name.trim(),
          department: department ? department.trim() : null,
          phone: phone ? phone.trim() : null,
          lesson_day: lesson_day || 'TUE',
          is_active: is_active ?? true,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 3. 회원 정보 수정 (PUT)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, employee_no, name, department, phone, lesson_day, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '회원 ID가 누락되었습니다.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('members')
      .update({
        employee_no: employee_no ? employee_no.trim() : undefined,
        name: name.trim(),
        department: department ? department.trim() : null,
        phone: phone ? phone.trim() : null,
        lesson_day: lesson_day || 'TUE',
        is_active: is_active ?? true,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}