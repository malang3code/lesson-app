import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/admin/lessons/copy  { fromDate, toDates: string[] }
export async function POST(req: Request) {
  try {
    const { fromDate, toDates } = await req.json();

    if (!fromDate || !Array.isArray(toDates) || toDates.length === 0) {
      return NextResponse.json({ error: 'fromDate, toDates가 필요합니다' }, { status: 400 });
    }

    // 1. 원본 날짜의 시간 슬롯 설정 조회 (slot_index 기준)
    const { data: sourceSlots, error: sourceSlotsErr } = await supabaseAdmin
      .from('lesson_date_slots')
      .select('id, slot_index, start_time, end_time, capacity')
      .eq('lesson_date', fromDate)
      .order('slot_index');

    if (sourceSlotsErr) {
      return NextResponse.json({ error: '원본 시간 슬롯 조회 실패' }, { status: 500 });
    }

    if (!sourceSlots || sourceSlots.length === 0) {
      return NextResponse.json({ error: '복사할 원본 날짜의 시간 설정이 없습니다.' }, { status: 400 });
    }

    // 원본 slot_id와 slot_index/capacity 매핑 맵
    const sourceSlotMap = new Map<number, { slot_index: number; capacity: number }>();
    sourceSlots.forEach((s) => {
      sourceSlotMap.set(s.id, { slot_index: s.slot_index, capacity: s.capacity ?? 2 });
    });

    // 2. 원본 날짜의 수강생 배정(lessons) 조회
    const { data: sourceLessons, error: sourceLessonsErr } = await supabaseAdmin
      .from('lessons')
      .select('time_slot_id, member_id')
      .eq('lesson_date', fromDate);

    if (sourceLessonsErr) {
      return NextResponse.json({ error: '원본 배정 조회 실패' }, { status: 500 });
    }

    const summary: Record<string, { copied: number; skipped: number }> = {};

    for (const toDate of toDates) {
      // 대상 날짜가 등록된 레슨일인지 확인
      const { data: dateExists } = await supabaseAdmin
        .from('lesson_dates')
        .select('lesson_date')
        .eq('lesson_date', toDate)
        .maybeSingle();

      if (!dateExists) {
        summary[toDate] = { copied: 0, skipped: sourceLessons?.length ?? 0 };
        continue;
      }

      // 3. 대상 날짜의 기존 시간 슬롯 설정을 삭제 후 원본 슬롯 구성으로 교체
      await supabaseAdmin
        .from('lesson_date_slots')
        .delete()
        .eq('lesson_date', toDate);

      const newSlotsToInsert = sourceSlots.map((s) => ({
        lesson_date: toDate,
        slot_index: s.slot_index,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity ?? 2,
      }));

      const { data: insertedSlots, error: insertSlotsErr } = await supabaseAdmin
        .from('lesson_date_slots')
        .insert(newSlotsToInsert)
        .select('id, slot_index');

      if (insertSlotsErr || !insertedSlots) {
        summary[toDate] = { copied: 0, skipped: sourceLessons?.length ?? 0 };
        continue;
      }

      // 새로 생성된 대상 날짜의 slot_index -> 새 slot_id 맵 생성
      const targetIndexToIdMap = new Map<number, number>();
      insertedSlots.forEach((s) => targetIndexToIdMap.set(s.slot_index, s.id));

      let copied = 0;
      let skipped = 0;

      // 4. 수강생 배정 복사
      if (sourceLessons && sourceLessons.length > 0) {
        for (const lesson of sourceLessons) {
          const sourceSlotInfo = sourceSlotMap.get(lesson.time_slot_id);
          if (!sourceSlotInfo) {
            skipped++;
            continue;
          }

          const targetSlotId = targetIndexToIdMap.get(sourceSlotInfo.slot_index);
          if (!targetSlotId) {
            skipped++;
            continue;
          }

          // 슬롯 정원 확인
          const { count } = await supabaseAdmin
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('lesson_date', toDate)
            .eq('time_slot_id', targetSlotId);

          if ((count ?? 0) >= sourceSlotInfo.capacity) {
            skipped++;
            continue;
          }

          const { error: insertErr } = await supabaseAdmin.from('lessons').insert({
            lesson_date: toDate,
            time_slot_id: targetSlotId,
            member_id: lesson.member_id,
          });

          if (insertErr) {
            skipped++;
          } else {
            copied++;
          }
        }
      }

      summary[toDate] = { copied, skipped };
    }

    return NextResponse.json({ success: true, summary });
  } catch (err: unknown) {
    console.error('🔥 Copy API Error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}