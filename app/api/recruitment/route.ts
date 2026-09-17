import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: 현재 모집 설정 조회
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('recruitment_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;

    // 화/목 time_slots 시작 시간 목록 조회
    const { data: slots, error: slotErr } = await supabaseAdmin
      .from('time_slots')
      .select('start_time')
      .order('start_time', { ascending: true });

    const timeSet = new Set<string>();
    if (!slotErr && slots) {
      slots.forEach((s: { start_time: string }) => {
        if (s.start_time) timeSet.add(s.start_time.slice(0, 5));
      });
    }

    return NextResponse.json({
      id: data.id,
      is_open: data.is_open,
      current_term: data.term_month, // 기존 프론트 호환용
      term_month: data.term_month,
      notice: data.notice,
      available_times: Array.from(timeSet).sort(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '모집 설정 조회 실패' }, { status: 500 });
  }
}

// PATCH: 관리자 모집 설정 변경
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { is_open, term_month, current_term, notice } = body;

    const targetTerm = term_month || current_term;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (is_open !== undefined) updatePayload.is_open = is_open;
    if (targetTerm !== undefined) updatePayload.term_month = targetTerm;
    if (notice !== undefined) updatePayload.notice = notice;

    const { data, error } = await supabaseAdmin
      .from('recruitment_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      setting: {
        ...data,
        current_term: data.term_month,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '모집 설정 수정 실패' }, { status: 500 });
  }
}