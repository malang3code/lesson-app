import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: 등록된 전체 레슨일 및 일자별 배정 건수 조회
export async function GET() {
  try {
    // 1. lesson_dates 테이블에서 등록된 날짜 조회
    const { data: dateRows, error: dateErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date')
      .order('lesson_date', { ascending: true });

    if (dateErr) {
      console.error('❌ [lesson_dates 조회 실패]:', dateErr);
      return NextResponse.json({ error: dateErr.message }, { status: 500 });
    }

    const dates = (dateRows ?? []).map((row: { lesson_date: string }) => row.lesson_date);

    // 2. lessons 테이블에서 배정 건수 조회
    const assignmentCounts: Record<string, number> = {};
    const { data: lessonRows, error: lessonErr } = await supabaseAdmin
      .from('lessons')
      .select('lesson_date');

    if (!lessonErr && lessonRows) {
      lessonRows.forEach((r: { lesson_date: string }) => {
        if (r.lesson_date) {
          assignmentCounts[r.lesson_date] = (assignmentCounts[r.lesson_date] || 0) + 1;
        }
      });
    }

    return NextResponse.json({ dates, assignmentCounts });
  } catch (err: any) {
    console.error('❌ [서버 내부 오류]:', err);
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 });
  }
}

// POST: 일괄 저장 (새로 선택된 날짜 추가 + 빠진 날짜 삭제)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. 일괄 저장 모드 ({ dates: string[] })
    if (Array.isArray(body.dates)) {
      const targetDates = new Set<string>(body.dates);

      // 현재 DB에 저장되어 있는 레슨일 목록 가져오기
      const { data: currentRows, error: getErr } = await supabaseAdmin
        .from('lesson_dates')
        .select('lesson_date');

      if (getErr) throw getErr;

      const currentDates = new Set<string>((currentRows ?? []).map((r: any) => r.lesson_date));

      // 추가해야 할 날짜들 (새로 켜진 날짜)
      const toInsert = body.dates
        .filter((d: string) => !currentDates.has(d))
        .map((d: string) => ({ lesson_date: d }));

      // 삭제해야 할 날짜들 (꺼진 날짜)
      const toDelete = Array.from(currentDates).filter((d: string) => !targetDates.has(d));

      // 삭제할 날짜에 연관된 lessons 배정 데이터 먼저 삭제
      if (toDelete.length > 0) {
        await supabaseAdmin
          .from('lessons')
          .delete()
          .in('lesson_date', toDelete);

        // lesson_dates 테이블에서 삭제
        const { error: delErr } = await supabaseAdmin
          .from('lesson_dates')
          .delete()
          .in('lesson_date', toDelete);

        if (delErr) throw delErr;
      }

      // 새로 추가된 레슨일 insert
      if (toInsert.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from('lesson_dates')
          .insert(toInsert);

        if (insErr) throw insErr;
      }

      return NextResponse.json({ success: true, inserted: toInsert.length, deleted: toDelete.length });
    }

    // 2. 단일 저장 fallback
    const targetDate = body.lesson_date || body.date;
    const isActive = body.isActive !== undefined ? body.isActive : body.is_active;

    if (!targetDate) {
      return NextResponse.json({ error: '날짜 정보가 없습니다.' }, { status: 400 });
    }

    if (isActive) {
      await supabaseAdmin.from('lesson_dates').upsert({ lesson_date: targetDate });
    } else {
      await supabaseAdmin.from('lessons').delete().eq('lesson_date', targetDate);
      await supabaseAdmin.from('lesson_dates').delete().eq('lesson_date', targetDate);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('❌ [POST 저장 오류]:', err);
    return NextResponse.json({ error: err?.message || '저장 실패' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}