import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 수강생 목록 조회 (GET)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .order('name');

    if (error) throw error;
    return NextResponse.json({ members: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 수강생 등록 (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, department, phone, employee_no } = body;

    // 이름 필수값 검증
    if (!name?.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    // 사번: 숫자 8자리 필수 검증
    const cleanEmpNo = (employee_no || '').replace(/[^0-9]/g, '');
    if (cleanEmpNo.length !== 8) {
      return NextResponse.json({ error: '사번은 숫자 8자리로 입력해주세요.' }, { status: 400 });
    }

    // 🎯 사번 중복 확인
    const { data: existingEmp, error: checkEmpErr } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('employee_no', cleanEmpNo);

    if (checkEmpErr) throw checkEmpErr;
    if (existingEmp && existingEmp.length > 0) {
      return NextResponse.json({ error: `이미 등록된 사번(${cleanEmpNo})입니다.` }, { status: 400 });
    }

    // 전화번호: 입력된 경우 숫자 11자리 검증 및 중복 체크
    let cleanPhone: string | null = null;
    if (phone?.trim()) {
      const pureDigits = phone.replace(/[^0-9]/g, '');
      if (pureDigits.length !== 11) {
        return NextResponse.json({ error: '전화번호는 숫자 11자리로 입력해주세요.' }, { status: 400 });
      }

      // 🎯 전화번호 중복 확인
      const { data: existingPhone, error: checkPhoneErr } = await supabaseAdmin
        .from('members')
        .select('id')
        .eq('phone', pureDigits);

      if (checkPhoneErr) throw checkPhoneErr;
      if (existingPhone && existingPhone.length > 0) {
        return NextResponse.json({ error: '이미 등록된 전화번호입니다.' }, { status: 400 });
      }

      cleanPhone = pureDigits;
    }

    const { data, error } = await supabaseAdmin
      .from('members')
      .insert({
        name: name.trim(),
        employee_no: cleanEmpNo,
        department: department?.trim() || null,
        phone: cleanPhone,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '사번 또는 전화번호가 이미 존재합니다.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, member: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 수강생 상태/정보 수정 (PATCH)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_active, name, department, phone, employee_no } = body;

    if (!id) {
      return NextResponse.json({ error: '회원 ID가 필요합니다.' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof is_active === 'boolean') updatePayload.is_active = is_active;
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: '이름은 필수 항목입니다.' }, { status: 400 });
      updatePayload.name = name.trim();
    }
    
    // 사번 수정 시 중복 검증
    if (employee_no !== undefined) {
      const cleanEmpNo = employee_no.replace(/[^0-9]/g, '');
      if (cleanEmpNo.length !== 8) {
        return NextResponse.json({ error: '사번은 숫자 8자리로 입력해주세요.' }, { status: 400 });
      }

      const { data: existing, error: checkErr } = await supabaseAdmin
        .from('members')
        .select('id')
        .eq('employee_no', cleanEmpNo)
        .neq('id', id);

      if (checkErr) throw checkErr;
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: `이미 사용 중인 사번(${cleanEmpNo})입니다.` }, { status: 400 });
      }

      updatePayload.employee_no = cleanEmpNo;
    }

    if (department !== undefined) updatePayload.department = department?.trim() || null;
    
    // 전화번호 수정 시 중복 검증
    if (phone !== undefined) {
      if (phone?.trim()) {
        const pureDigits = phone.replace(/[^0-9]/g, '');
        if (pureDigits.length !== 11) {
          return NextResponse.json({ error: '전화번호는 숫자 11자리로 입력해주세요.' }, { status: 400 });
        }

        const { data: existing, error: checkPhoneErr } = await supabaseAdmin
          .from('members')
          .select('id')
          .eq('phone', pureDigits)
          .neq('id', id);

        if (checkPhoneErr) throw checkPhoneErr;
        if (existing && existing.length > 0) {
          return NextResponse.json({ error: '이미 사용 중인 전화번호입니다.' }, { status: 400 });
        }

        updatePayload.phone = pureDigits;
      } else {
        updatePayload.phone = null;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('members')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '사번 또는 전화번호가 중복됩니다.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, member: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 수강생 삭제 (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '회원 ID가 필요합니다.' }, { status: 400 });
    }

    await supabaseAdmin.from('lessons').delete().eq('member_id', Number(id));

    const { error } = await supabaseAdmin.from('members').delete().eq('id', Number(id));
    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}