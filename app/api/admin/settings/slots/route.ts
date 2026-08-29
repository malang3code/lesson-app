import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 시간대 목록 조회 (GET)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('time_slots')
      .select('*')
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;
    return NextResponse.json({ slots: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 시간대 등록 (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { day_of_week, start_time, end_time, capacity } = body;

    if (day_of_week === undefined || !start_time || !end_time) {
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('time_slots')
      .insert({
        day_of_week: Number(day_of_week),
        start_time: start_time.trim(),
        end_time: end_time.trim(),
        capacity: Number(capacity) || 2,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, slot: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 시간대 삭제 (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '시간대 ID가 필요합니다.' }, { status: 400 });
    }

    // 연관된 레슨 배정 내역 먼저 정리
    await supabaseAdmin.from('lessons').delete().eq('time_slot_id', Number(id));

    const { error } = await supabaseAdmin.from('time_slots').delete().eq('id', Number(id));
    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}