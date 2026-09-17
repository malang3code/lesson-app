import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: 등록된 전체 레슨일 및 배정 건수, 기수(termMap) 조회
export async function GET() {
  try {
    const { data: dateRows, error: dateErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date, term_month')
      .order('lesson_date', { ascending: true });

    if (dateErr) {
      console.error('❌ [lesson_dates 조회 실패]:', dateErr);
      return NextResponse.json({ error: dateErr.message }, { status: 500 });
    }

    const dates = (dateRows ?? []).map((row: { lesson_date: string }) => row.lesson_date);

    const termMap: Record<string, string> = {};
    (dateRows ?? []).forEach((row: { lesson_date: string; term_month?: string | null }) => {
      termMap[row.lesson_date] = row.term_month || row.lesson_date.slice(0, 7);
    });

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

// POST: 일괄 저장 (마지막 1개 날짜 방어 로직 적용)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.dates)) {
      return NextResponse.json({ error: 'dates 배열이 필요합니다.' }, { status: 400 });
    }

    const targetDates = new Set<string>(body.dates);

    // 현재 DB의 레슨일 목록
    const { data: currentRows, error: getErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date, term_month');

    if (getErr) throw getErr;

    const currentMap = new Map<string, string>();
    (currentRows ?? []).forEach((r: any) => {
      currentMap.set(r.lesson_date, r.term_month || r.lesson_date.slice(0, 7));
    });

    // 꺼진 날짜들 (삭제 대상)
    const toDelete = Array.from(currentMap.keys()).filter((d) => !targetDates.has(d));

    if (toDelete.length > 0) {
      // 🛡️ [안전장치 1] 삭제 대상 날짜들의 기수 파악
      const affectedTerms = new Set<string>();
      toDelete.forEach((d) => {
        const tm = currentMap.get(d);
        if (tm) affectedTerms.add(tm);
      });

      // 변경 후 남게 될 기수별 날짜 카운트
      const remainingTermCounts = new Map<string, number>();
      body.dates.forEach((d: string) => {
        const tm = body.dateItems?.find((it: any) => it.lesson_date === d)?.term_month || currentMap.get(d) || d.slice(0, 7);
        remainingTermCounts.set(tm, (remainingTermCounts.get(tm) || 0) + 1);
      });

      // 각 영향받는 기수에 수강 신청서(applications)나 확정자(term_members)가 있는지 확인
      for (const term of affectedTerms) {
        const remainingCount = remainingTermCounts.get(term) || 0;

        // 해당 기수에 남은 날짜가 0개가 되려고 할 때 검사
        if (remainingCount === 0) {
          const [{ count: appCount }, { count: termMemberCount }] = await Promise.all([
            supabaseAdmin
              .from('lesson_applications')
              .select('id', { count: 'exact', head: true })
              .eq('term_month', term),
            supabaseAdmin
              .from('term_members')
              .select('id', { count: 'exact', head: true })
              .eq('term_month', term),
          ]);

          if ((appCount ?? 0) > 0 || (termMemberCount ?? 0) > 0) {
            return NextResponse.json(
              {
                error: `[${term}] 기수에 신청 내역(${appCount || 0}건) 또는 수강생 명단(${termMemberCount || 0}건)이 존재합니다. 기수 유지를 위해 최소 1개의 레슨일은 유지되어야 합니다.`,
              },
              { status: 400 }
            );
          }
        }
      }

      // 🛡️ [안전장치 2] 연관 lessons 배정 데이터 삭제 후 날짜 삭제
      await supabaseAdmin.from('lessons').delete().in('lesson_date', toDelete);
      const { error: delErr } = await supabaseAdmin.from('lesson_dates').delete().in('lesson_date', toDelete);
      if (delErr) throw delErr;
    }

    // 신규 추가 및 기수 갱신 upsert
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

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('lesson_dates')
        .upsert(rowsToUpsert, { onConflict: 'lesson_date' });

      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({ success: true, count: rowsToUpsert.length, deleted: toDelete.length });
  } catch (err: any) {
    console.error('❌ [POST 저장 오류]:', err);
    return NextResponse.json({ error: err?.message || '저장 실패' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}