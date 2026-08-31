import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getExactDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// 1. 특정 날짜 관련 스왑 히스토리 조회 (GET) - 처음 생성된 순(오름차순)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ histories: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('lesson_swap_histories')
      .select('*')
      .or(`source_date.eq.${date},target_date.eq.${date}`)
      .order('created_at', { ascending: true }); // 👈 처음 생성된 건이 맨 위로

    if (error) throw error;

    return NextResponse.json({ histories: data || [] });
  } catch (err: any) {
    console.error('Fetch swap histories error:', err);
    return NextResponse.json({ error: err.message || '히스토리 조회 실패' }, { status: 500 });
  }
}

// 2. 수강생 일정 맞교환 및 히스토리 기록 (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, target } = body;

    if (!source || !target) {
      return NextResponse.json({ error: '교환 대상 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // 1) A의 기존 배정 조회
    const { data: sourceAssigned, error: sErr } = await supabaseAdmin
      .from('lessons')
      .select('id, is_completed')
      .eq('lesson_date', source.lessonDate)
      .eq('time_slot_id', source.timeSlotId)
      .eq('member_id', source.memberId)
      .maybeSingle();

    if (sErr || !sourceAssigned) {
      return NextResponse.json({ error: '원본 수강생의 배정 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2) B의 기존 배정 조회
    let targetAssignedId: number | null = null;
    if (target.memberId) {
      const { data: targetAssigned, error: tErr } = await supabaseAdmin
        .from('lessons')
        .select('id, is_completed')
        .eq('lesson_date', target.lessonDate)
        .eq('time_slot_id', target.timeSlotId)
        .eq('member_id', target.memberId)
        .maybeSingle();

      if (tErr || !targetAssigned) {
        return NextResponse.json({ error: '대상 수강생의 배정 정보를 찾을 수 없습니다.' }, { status: 404 });
      }
      targetAssignedId = targetAssigned.id;
    }

    // 3) A를 target 위치로 이동
    const { error: updateSourceErr } = await supabaseAdmin
      .from('lessons')
      .update({
        lesson_date: target.lessonDate,
        time_slot_id: target.timeSlotId,
      })
      .eq('id', sourceAssigned.id);

    if (updateSourceErr) throw updateSourceErr;

    // 4) B를 source 위치로 이동
    if (targetAssignedId) {
      const { error: updateTargetErr } = await supabaseAdmin
        .from('lessons')
        .update({
          lesson_date: source.lessonDate,
          time_slot_id: source.timeSlotId,
        })
        .eq('id', targetAssignedId);

      if (updateTargetErr) throw updateTargetErr;
    }

    // 5) 히스토리 기록
    const { error: histErr } = await supabaseAdmin
      .from('lesson_swap_histories')
      .insert({
        source_date: source.lessonDate,
        source_time: source.timeStr.slice(0, 5),
        source_slot_id: source.timeSlotId,
        source_member_id: source.memberId,
        source_member_name: source.memberName,
        target_date: target.lessonDate,
        target_time: target.timeStr.slice(0, 5),
        target_slot_id: target.timeSlotId,
        target_member_id: target.memberId || null,
        target_member_name: target.memberName || '빈자리',
      });

    if (histErr) console.warn('History insert warning:', histErr);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Swap execution error:', err);
    return NextResponse.json({ error: err.message || '스왑 처리 실패' }, { status: 500 });
  }
}

// 3. 스왑 원복 및 히스토리 완전 삭제 (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const historyId = searchParams.get('id');

    if (!historyId) {
      return NextResponse.json({ error: '히스토리 ID가 필요합니다.' }, { status: 400 });
    }

    // 1) 히스토리 조회
    const { data: hist, error: hErr } = await supabaseAdmin
      .from('lesson_swap_histories')
      .select('*')
      .eq('id', historyId)
      .single();

    if (hErr || !hist) {
      return NextResponse.json({ error: '변경 이력을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2) 원본 / 대상 time_slot_id 확보
    let origSourceSlotId = hist.source_slot_id;
    let origTargetSlotId = hist.target_slot_id;

    const sourceDow = getExactDayOfWeek(hist.source_date);
    const targetDow = getExactDayOfWeek(hist.target_date);

    if (!origSourceSlotId) {
      const { data: allSlots } = await supabaseAdmin
        .from('time_slots')
        .select('id, start_time')
        .eq('day_of_week', sourceDow);

      const matched = (allSlots || []).find((s) => s.start_time.startsWith(hist.source_time.slice(0, 5)));
      if (matched) origSourceSlotId = matched.id;
    }

    if (hist.target_member_id && !origTargetSlotId) {
      const { data: allSlots } = await supabaseAdmin
        .from('time_slots')
        .select('id, start_time')
        .eq('day_of_week', targetDow);

      const matched = (allSlots || []).find((s) => s.start_time.startsWith(hist.target_time.slice(0, 5)));
      if (matched) origTargetSlotId = matched.id;
    }

    if (!origSourceSlotId) {
      return NextResponse.json({ error: `원본 시간대(${hist.source_date} ${hist.source_time}) 정보를 찾을 수 없습니다.` }, { status: 400 });
    }

    // 3) A의 현재 배정 확인
    const aQuery = supabaseAdmin
      .from('lessons')
      .select('id, time_slot_id')
      .eq('lesson_date', hist.target_date)
      .eq('member_id', hist.source_member_id);

    if (origTargetSlotId) {
      aQuery.eq('time_slot_id', origTargetSlotId);
    }

    const { data: currentALesson } = await aQuery.maybeSingle();

    if (!currentALesson) {
      return NextResponse.json(
        { error: `수강생(${hist.source_member_name})의 위치가 이후에 추가 변경되어 자동 원복할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 4) B의 현재 배정 확인
    let currentBLessonId: number | null = null;
    if (hist.target_member_id) {
      const { data: currentBLesson } = await supabaseAdmin
        .from('lessons')
        .select('id')
        .eq('lesson_date', hist.source_date)
        .eq('time_slot_id', origSourceSlotId)
        .eq('member_id', hist.target_member_id)
        .maybeSingle();

      if (!currentBLesson) {
        return NextResponse.json(
          { error: `수강생(${hist.target_member_name})의 위치가 이후에 추가 변경되어 자동 원복할 수 없습니다.` },
          { status: 400 }
        );
      }
      currentBLessonId = currentBLesson.id;
    }

    // 5) A 복구
    const { error: revAErr } = await supabaseAdmin
      .from('lessons')
      .update({
        lesson_date: hist.source_date,
        time_slot_id: origSourceSlotId,
      })
      .eq('id', currentALesson.id);

    if (revAErr) throw revAErr;

    // 6) B 복구
    if (currentBLessonId && origTargetSlotId) {
      const { error: revBErr } = await supabaseAdmin
        .from('lessons')
        .update({
          lesson_date: hist.target_date,
          time_slot_id: origTargetSlotId,
        })
        .eq('id', currentBLessonId);

      if (revBErr) throw revBErr;
    }

    // 7) 히스토리 완전 삭제
    const { error: delHistErr } = await supabaseAdmin
      .from('lesson_swap_histories')
      .delete()
      .eq('id', historyId);

    if (delHistErr) throw delHistErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Revert swap error:', err);
    return NextResponse.json({ error: err.message || '원복 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}