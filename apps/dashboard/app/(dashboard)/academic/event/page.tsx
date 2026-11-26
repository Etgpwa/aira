import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EventQuizClient from './components/EventQuizClient';

export const revalidate = 0;

export default async function AcademicEventPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notFound();

    const { data: modules, error } = await supabase
        .from('course_modules')
        .select('id, subject_name, module_title, kb_title, is_completed, questions:course_quiz_questions(count), mcq_questions:course_quiz_questions(count)')
        .eq('user_id', user.id)
        .eq('mcq_questions.question_type', 'MCQ')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return <EventQuizClient modules={modules || []} />;
}
