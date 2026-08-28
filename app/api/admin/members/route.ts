import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 회원 목록 전체 조회 (활성/비활성 모두 포함)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name');

    if (error) throw error;
    return NextResponse.json({ members: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 신규 회원 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, department, phone } = body;

    if (!name) {
      return NextResponse.json({ error: '이름은 필수 항목입니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('members')
      .insert([{ name, department: department || null, phone: phone || null, is_active: true }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ member: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 회원 활성화/비활성화(수강/미수강) 상태 변경
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_active } = body;

    if (id === undefined || is_active === undefined) {
      return NextResponse.json({ error: 'id와 is_active 값은 필수입니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('members')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ member: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}