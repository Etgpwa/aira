import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EventQuizClient from './components/EventQuizClient';

export const revalidate = 0;

export default async function AcademicEventPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notFound();

    const { data: modules } = await supabase
        .from('course_modules')
        .select('*, course_quiz_questions(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return <EventQuizClient modules={modules || []} />;
}
