import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 활성화된 레슨일 및 해당 일자의 배정 건수 조회
export async function GET() {
  try {
    const { data: lessonDates, error: datesErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date')
      .order('lesson_date');

    if (datesErr) throw datesErr;

    // 배정된 건수 체크
    const { data: lessons, error: lessonsErr } = await supabaseAdmin
      .from('lessons')
      .select('lesson_date');

    const assignmentCounts: Record<string, number> = {};
    if (!lessonsErr && lessons) {
      lessons.forEach((l: { lesson_date: string }) => {
        if (l.lesson_date) {
          assignmentCounts[l.lesson_date] = (assignmentCounts[l.lesson_date] || 0) + 1;
        }
      });
    }

    return NextResponse.json({
      dates: (lessonDates ?? []).map((row) => row.lesson_date),
      assignmentCounts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('GET lesson-dates error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 개별 날짜 토글 (forceDelete 옵션 지원)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, isActive, forceDelete } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    if (isActive) {
      // 1. 레슨일 추가
      const { error } = await supabaseAdmin
        .from('lesson_dates')
        .upsert({ lesson_date: date }, { onConflict: 'lesson_date' });
      if (error) throw error;
    } else {
      // 2. 개별 해제 시 배정 내역 확인
      if (!forceDelete) {
        const { count, error: countErr } = await supabaseAdmin
          .from('lessons')
          .select('*', { count: 'exact', head: true })
          .eq('lesson_date', date);

        if (!countErr && count && count > 0) {
          return NextResponse.json(
            {
              requireConfirm: true,
              assignmentCount: count,
              message: `해당 날짜에 ${count}건의 배정 내역이 존재합니다.`,
            },
            { status: 409 }
          );
        }
      }

      // 배정 데이터 삭제 (강제 해제 승인 시)
      await supabaseAdmin.from('lessons').delete().eq('lesson_date', date);

      // 레슨일 삭제
      const { error: delDateErr } = await supabaseAdmin
        .from('lesson_dates')
        .delete()
        .eq('lesson_date', date);

      if (delDateErr) throw delDateErr;
    }

    return NextResponse.json({ success: true, date, isActive });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('POST lesson-dates error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 일괄 등록 및 일괄 해제 (해제 시 배정 없는 날만 안전 삭제)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { dates, isActive } = body;

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'dates array is required' }, { status: 400 });
    }

    if (isActive) {
      // 일괄 활성화
      const rows = dates.map((d: string) => ({ lesson_date: d }));
      const { error } = await supabaseAdmin
        .from('lesson_dates')
        .upsert(rows, { onConflict: 'lesson_date' });
      if (error) throw error;

      return NextResponse.json({ success: true, count: dates.length, isActive });
    } else {
      // 🔒 전체 해제: 배정 데이터가 있는 날짜는 제외하고 빈 날짜만 찾아서 삭제
      const { data: assignedLessons, error: assignErr } = await supabaseAdmin
        .from('lessons')
        .select('lesson_date')
        .in('lesson_date', dates);

      if (assignErr) throw assignErr;

      const assignedDateSet = new Set((assignedLessons ?? []).map((l: { lesson_date: string }) => l.lesson_date));
      const targetDatesToDelete = dates.filter((d: string) => !assignedDateSet.has(d));

      if (targetDatesToDelete.length > 0) {
        const { error: delErr } = await supabaseAdmin
          .from('lesson_dates')
          .delete()
          .in('lesson_date', targetDatesToDelete);

        if (delErr) throw delErr;
      }

      return NextResponse.json({
        success: true,
        deletedDates: targetDatesToDelete,
        preservedCount: assignedDateSet.size,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('PUT lesson-dates error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}