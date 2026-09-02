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

    // 2. 해당 기수 레슨일들에 배정된 lessons 데이터 조회 (is_swap, is_completed 포함)
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

    // 3. 해당 기수 레슨에 실제로 배정된 회원 ID 목록만 추출
    const activeMemberIds = Array.from(new Set(lessons.map((l) => l.member_id)));

    // 4. 배정된 회원 정보 조회 (이름 가나다순 정렬)
    const { data: members, error: memErr } = await supabaseAdmin
      .from('members')
      .select('id, name')
      .in('id', activeMemberIds)
      .order('name', { ascending: true });

    if (memErr) throw memErr;

    // 5. 회원별 소속 세션(화/목) 판별 및 출석 집계
    const memberStats = (members || []).map((m) => {
      const myLessons = lessons.filter((l) => l.member_id === m.id);

      // 🎯 [스왑 꼬리표 없는 정규 배정] 날짜의 요일 검사
      const regularLessons = myLessons.filter((l) => !l.is_swap);

      let hasRegularTue = false;
      let hasRegularThu = false;

      regularLessons.forEach((l) => {
        const [y, mon, d] = l.lesson_date.split('-').map(Number);
        const dow = new Date(y, mon - 1, d).getDay();
        if (dow === 2) hasRegularTue = true;
        if (dow === 4) hasRegularThu = true;
      });

      // 소속 요일 확정 (정규 배정 요일 기준)
      let resolvedLessonDay = 'TUE';
      if (hasRegularTue && hasRegularThu) {
        resolvedLessonDay = 'BOTH';
      } else if (hasRegularThu) {
        resolvedLessonDay = 'THU';
      } else if (hasRegularTue) {
        resolvedLessonDay = 'TUE';
      } else {
        // 만약 모든 수업이 스왑으로 배정된 특수 케이스면 첫 번째 배정 요일 채택
        const first = myLessons[0];
        if (first) {
          const [y, mon, d] = first.lesson_date.split('-').map(Number);
          resolvedLessonDay = new Date(y, mon - 1, d).getDay() === 4 ? 'THU' : 'TUE';
        }
      }

      // 출석 완료 횟수 (스왑 다녀온 수업 포함 총 출석)
      const completedCount = myLessons.filter((l) => l.is_completed).length;

      return {
        id: m.id,
        name: m.name,
        lessonDay: resolvedLessonDay, // 이번 달 정규 세션 (TUE, THU, BOTH)
        targetCount: 4,               // 기준 4회
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