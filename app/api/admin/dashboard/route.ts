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

    // 1. 해당 기수에 속한 레슨일 조회
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
        tueAbsentCount: 0,
        thuAbsentCount: 0,
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

    // 🎯 한국 시간(Asia/Seoul) 기준 오늘 날짜(YYYY-MM-DD) 추출
    // UTC 기준 시 아침 9시까지 전날로 잡히던 문제를 해결하여 자정 직후 즉시 반영
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    let tueAbsentCount = 0;
    let thuAbsentCount = 0;

    lessons.forEach((l) => {
      if (l.lesson_date < today && !l.is_completed) {
        const [y, m, d] = l.lesson_date.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        if (dow === 2) tueAbsentCount++;
        if (dow === 4) thuAbsentCount++;
      }
    });

    if (lessons.length === 0) {
      return NextResponse.json({
        term,
        totalDates: dates.length,
        tueCount,
        thuCount,
        tueAbsentCount: 0,
        thuAbsentCount: 0,
        dates,
        members: [],
      });
    }

    // 3. 해당 기수 레슨에 실제로 배정된 회원 ID 목록 추출
    const activeMemberIds = Array.from(new Set(lessons.map((l) => l.member_id)));

    // 4. 배정된 회원 정보 조회 (DB 원 소속 요일 lesson_day 확인)
    const { data: members, error: memErr } = await supabaseAdmin
      .from('members')
      .select('id, name, lesson_day')
      .in('id', activeMemberIds)
      .order('name', { ascending: true });

    if (memErr) throw memErr;

    // 5. 회원별 요일 판별 및 퐁당퐁당 출석/결석 집계
    const memberStats = (members || []).map((m) => {
      // 날짜 순서대로 정렬
      const myLessons = lessons
        .filter((l) => l.member_id === m.id)
        .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));

      const baseLessonDay = (m.lesson_day || 'TUE') as 'TUE' | 'THU' | 'BOTH';
      let resolvedLessonDay: 'TUE' | 'THU' | 'BOTH' = baseLessonDay;

      if (baseLessonDay === 'BOTH' && myLessons.length > 4) {
        resolvedLessonDay = 'BOTH';
      } else if (baseLessonDay === 'BOTH') {
        let tCount = 0;
        let thCount = 0;
        myLessons.forEach((l) => {
          const [y, mon, d] = l.lesson_date.split('-').map(Number);
          const dow = new Date(y, mon - 1, d).getDay();
          if (dow === 2) tCount++;
          if (dow === 4) thCount++;
        });
        resolvedLessonDay = tCount >= thCount ? 'TUE' : 'THU';
      } else {
        // 단일 요일 회원은 스왑과 무관하게 본래 요일 고정
        resolvedLessonDay = baseLessonDay;
      }

      // 개인별 총 출석/결석
      const completedCount = myLessons.filter((l) => l.is_completed).length;
      const absentCount = myLessons.filter((l) => l.lesson_date < today && !l.is_completed).length;

      let tueCompletedCount = 0;
      let tueAbsentCountIndiv = 0;
      let thuCompletedCount = 0;
      let thuAbsentCountIndiv = 0;

      if (resolvedLessonDay === 'BOTH') {
        // 🎯 BOTH 회원은 날짜순으로 인덱스를 따라 퐁당퐁당 분배
        // index 0, 2, 4, 6 -> 화요일 세션 슬롯
        // index 1, 3, 5, 7 -> 목요일 세션 슬롯
        myLessons.forEach((l, idx) => {
          const isCompleted = !!l.is_completed;
          const isAbsent = l.lesson_date < today && !isCompleted;

          if (idx % 2 === 0) {
            // 화요일 몫
            if (isCompleted) tueCompletedCount++;
            if (isAbsent) tueAbsentCountIndiv++;
          } else {
            // 목요일 몫
            if (isCompleted) thuCompletedCount++;
            if (isAbsent) thuAbsentCountIndiv++;
          }
        });
      } else {
        // 단일 요일 회원은 본인 총 횟수 그대로 배분
        if (resolvedLessonDay === 'TUE') {
          tueCompletedCount = completedCount;
          tueAbsentCountIndiv = absentCount;
        } else {
          thuCompletedCount = completedCount;
          thuAbsentCountIndiv = absentCount;
        }
      }

      return {
        id: m.id,
        name: m.name,
        lessonDay: resolvedLessonDay,
        targetCount: resolvedLessonDay === 'BOTH' ? 8 : 4,
        assignedCount: myLessons.length,
        completedCount,
        absentCount,
        tueCompletedCount,
        tueAbsentCount: tueAbsentCountIndiv,
        thuCompletedCount,
        thuAbsentCount: thuAbsentCountIndiv,
      };
    });

    return NextResponse.json({
      term,
      totalDates: dates.length,
      tueCount,
      thuCount,
      tueAbsentCount,
      thuAbsentCount,
      dates,
      members: memberStats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '대시보드 데이터 조회 실패';
    console.error('Dashboard logic error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}