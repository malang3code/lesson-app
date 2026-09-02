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

    const today = new Date().toISOString().slice(0, 10);
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

    // 4. 배정된 회원 정보 조회
    const { data: members, error: memErr } = await supabaseAdmin
      .from('members')
      .select('id, name')
      .in('id', activeMemberIds)
      .order('name', { ascending: true });

    if (memErr) throw memErr;

    // 5. 회원별 본래 요일 복원 및 출석/결석 집계
    const memberStats = (members || []).map((m) => {
      const myLessons = lessons.filter((l) => l.member_id === m.id);

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

      let resolvedLessonDay: 'TUE' | 'THU' | 'BOTH' = 'TUE';

      if (tueLessonCount > 0 && thuLessonCount > 0) {
        if (myLessons.length > 4) {
          resolvedLessonDay = 'BOTH';
        } else {
          resolvedLessonDay = tueLessonCount >= thuLessonCount ? 'TUE' : 'THU';
        }
      } else if (thuLessonCount > 0) {
        resolvedLessonDay = 'THU';
      } else {
        resolvedLessonDay = 'TUE';
      }

      // 🎯 개인별 출석 횟수 및 결석 횟수 집계
      const completedCount = myLessons.filter((l) => l.is_completed).length;
      const absentCount = myLessons.filter((l) => l.lesson_date < today && !l.is_completed).length;

      return {
        id: m.id,
        name: m.name,
        lessonDay: resolvedLessonDay,
        targetCount: resolvedLessonDay === 'BOTH' ? 8 : 4,
        assignedCount: myLessons.length,
        completedCount,
        absentCount, // 🎯 회원별 결석 회수 추가
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
  } catch (err: any) {
    console.error('Dashboard logic error:', err);
    return NextResponse.json({ error: err.message || '대시보드 데이터 조회 실패' }, { status: 500 });
  }
}