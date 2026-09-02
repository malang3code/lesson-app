import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: 등록된 전체 레슨일 및 일자별 배정 건수, 기수(termMap) 조회
export async function GET() {
  try {
    // 1. lesson_dates 테이블에서 등록된 날짜 및 term_month 조회
    const { data: dateRows, error: dateErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date, term_month')
      .order('lesson_date', { ascending: true });

    if (dateErr) {
      console.error('❌ [lesson_dates 조회 실패]:', dateErr);
      return NextResponse.json({ error: dateErr.message }, { status: 500 });
    }

    const dates = (dateRows ?? []).map((row: { lesson_date: string }) => row.lesson_date);
    
    // 기수 매핑 객체 생성
    const termMap: Record<string, string> = {};
    (dateRows ?? []).forEach((row: { lesson_date: string; term_month?: string | null }) => {
      termMap[row.lesson_date] = row.term_month || row.lesson_date.slice(0, 7);
    });

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

    return NextResponse.json({ dates, termMap, assignmentCounts });
  } catch (err: any) {
    console.error('❌ [서버 내부 오류]:', err);
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 });
  }
}

// POST: 일괄 저장 (새로 선택된 날짜 추가/기수 갱신 + 빠진 날짜 삭제)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. 일괄 저장 모드 ({ dates: string[], dateItems?: { lesson_date: string, term_month: string }[] })
    if (Array.isArray(body.dates)) {
      const targetDates = new Set<string>(body.dates);

      // 현재 DB에 저장되어 있는 레슨일 목록 가져오기
      const { data: currentRows, error: getErr } = await supabaseAdmin
        .from('lesson_dates')
        .select('lesson_date');

      if (getErr) throw getErr;

      const currentDates = new Set<string>((currentRows ?? []).map((r: any) => r.lesson_date));

      // 삭제해야 할 날짜들 (꺼진 날짜)
      const toDelete = Array.from(currentDates).filter((d: string) => !targetDates.has(d));

      // 삭제할 날짜에 연관된 lessons 배정 데이터 먼저 삭제 (원본 안전장치 유지)
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

      // 등록 및 갱신할 레슨일 데이터 구성 (term_month 매핑 적용)
      const dateItemsMap: Record<string, string> = {};
      if (Array.isArray(body.dateItems)) {
        body.dateItems.forEach((item: { lesson_date: string; term_month: string }) => {
          if (item.lesson_date) {
            dateItemsMap[item.lesson_date] = item.term_month;
          }
        });
      }

      const rowsToUpsert = body.dates.map((d: string) => ({
        lesson_date: d,
        term_month: dateItemsMap[d] || d.slice(0, 7),
      }));

      // upsert로 새 날짜는 INSERT하고 기존 날짜는 term_month만 안전하게 UPDATE
      if (rowsToUpsert.length > 0) {
        const { error: upsertErr } = await supabaseAdmin
          .from('lesson_dates')
          .upsert(rowsToUpsert, { onConflict: 'lesson_date' });

        if (upsertErr) throw upsertErr;
      }

      return NextResponse.json({ success: true, count: rowsToUpsert.length, deleted: toDelete.length });
    }

    // 2. 단일 저장 fallback (기존 로직 보존)
    const targetDate = body.lesson_date || body.date;
    const isActive = body.isActive !== undefined ? body.isActive : body.is_active;
    const termMonth = body.term_month || (targetDate ? targetDate.slice(0, 7) : null);

    if (!targetDate) {
      return NextResponse.json({ error: '날짜 정보가 없습니다.' }, { status: 400 });
    }

    if (isActive) {
      await supabaseAdmin.from('lesson_dates').upsert({
        lesson_date: targetDate,
        term_month: termMonth,
      }, { onConflict: 'lesson_date' });
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