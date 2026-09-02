import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term'); // 예: '2026-09'

    if (!term) {
      return NextResponse.json({ error: '기수(term) 파라미터가 필요합니다.' }, { status: 400 });
    }

    // 1. 해당 기수에 속한 레슨일 8개(화/목) 조회
    const { data: termDates, error: dateErr } = await supabaseAdmin
      .from('lesson_dates')
      .select('lesson_date')
      .eq('term_month', term)
      .order('lesson_date', { ascending: true });

    if (dateErr) throw dateErr;

    const dates = (termDates || []).map((d) => d.lesson_date);

    let tueCount = 0;
    let thuCount = 0;
    dates.forEach((d) => {
      const [y, m, day] = d.split('-').map(Number);
      const dow = new Date(y, m - 1, day).getDay();
      if (dow === 2) tueCount++;
      if (dow === 4) thuCount++;
    });

    if (dates.length === 0) {
      return NextResponse.json({
        term,
        totalDates: 0,
        tueCount: 0,
        thuCount: 0,
        dates: [],
        members: [],
      });
    }

    // 2. 해당 기수 레슨일들에 배정된 lessons 데이터 조회
    const { data: lessonData, error: lErr } = await supabaseAdmin
      .from('lessons')
      .select('member_id, lesson_date, is_completed, is_swap')
      .in('lesson_date', dates);

    if (lErr) throw lErr;
    const lessons = lessonData || [];

    if (lessons.length === 0) {
      return NextResponse.json({
        term,
        totalDates: dates.length,
        tueCount,
        thuCount,
        dates,
        members: [],
      });
    }

    // 3. 해당 기수 레슨에 실제로 배정된 회원 ID 목록 추출
    const activeMemberIds = Array.from(new Set(lessons.map((l) => l.member_id)));

    // 4. 배정된 회원 기본 정보 조회 (이름 가나다순)
    const { data: members, error: memErr } = await supabaseAdmin
      .from('members')
      .select('id, name')
      .in('id', activeMemberIds)
      .order('name', { ascending: true });

    if (memErr) throw memErr;

    // 5. 해당 기수 레슨 배정 데이터를 기반으로 회원별 본래 요일 복원 및 출석 집계
    const memberStats = (members || []).map((m) => {
      const myLessons = lessons.filter((l) => l.member_id === m.id);

      // 스왑이 아닌 정규 배정 레슨 우선 확인
      const regularLessons = myLessons.filter((l) => !l.is_swap);
      const targetLessons = regularLessons.length > 0 ? regularLessons : myLessons;

      let tueLessonCount = 0;
      let thuLessonCount = 0;

      targetLessons.forEach((l) => {
        const [y, mon, d] = l.lesson_date.split('-').map(Number);
        const dow = new Date(y, mon - 1, d).getDay();
        if (dow === 2) tueLessonCount++;
        if (dow === 4) thuLessonCount++;
      });

      // 🎯 [핵심] 요일 판정 로직:
      // 둘 다 수업이 있더라도 더 많이 배정된 요일을 본래 세션으로 확정 (교차 배정으로 인한 BOTH 오염 방지)
      let resolvedLessonDay: 'TUE' | 'THU' | 'BOTH' = 'TUE';

      if (tueLessonCount > 0 && thuLessonCount > 0) {
        // 화/목 양쪽 모두 최소 3회 이상(총 6회 이상 정규 주2회인 경우)만 BOTH로 인정
        if (tueLessonCount >= 3 && thuLessonCount >= 3) {
          resolvedLessonDay = 'BOTH';
        } else {
          // 어느 한쪽이 1~2회 섞여 들어간 것은 교차/보강 배정이므로 횟수가 더 많은 쪽을 본래 요일로 확정
          resolvedLessonDay = tueLessonCount >= thuLessonCount ? 'TUE' : 'THU';
        }
      } else if (thuLessonCount > 0) {
        resolvedLessonDay = 'THU';
      } else {
        resolvedLessonDay = 'TUE';
      }

      // 출석 완료 횟수 (스왑/교차 수업 포함 총 출석)
      const completedCount = myLessons.filter((l) => l.is_completed).length;

      return {
        id: m.id,
        name: m.name,
        lessonDay: resolvedLessonDay, // 과거 시점 배정 데이터 기반으로 완벽 복원된 요일
        targetCount: resolvedLessonDay === 'BOTH' ? 8 : 4,
        assignedCount: myLessons.length,
        completedCount,
      };
    });

    return NextResponse.json({
      term,
      totalDates: dates.length,
      tueCount,
      thuCount,
      dates,
      members: memberStats,
    });
  } catch (err: any) {
    console.error('Dashboard logic error:', err);
    return NextResponse.json({ error: err.message || '대시보드 데이터 조회 실패' }, { status: 500 });
  }
}