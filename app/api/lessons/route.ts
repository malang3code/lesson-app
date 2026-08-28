import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'date 파라미터가 필요합니다' }, { status: 400 });
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();

  const [{ data: slots, error: slotsErr }, { data: lessons, error: lessonsErr }] =
    await Promise.all([
      supabaseAdmin
        .from('time_slots')
        .select('id, start_time, end_time, capacity')
        .eq('day_of_week', dow)
        .order('start_time'),
      supabaseAdmin
        .from('lessons')
        .select('time_slot_id, members ( name )')
        .eq('lesson_date', dateStr),
    ]);

  if (slotsErr || lessonsErr) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  const result = (slots ?? []).map((slot) => ({
    id: slot.id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    names: (lessons ?? [])
      .filter((l) => l.time_slot_id === slot.id)
      .map((l: any) => l.members.name),
  }));

  return NextResponse.json({ slots: result });
}