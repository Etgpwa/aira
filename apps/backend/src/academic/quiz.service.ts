import { supabase } from '../supabase/supabase.client';
import { askGeminiVision } from '../ai/gemini.client';
import { academicService } from './academic.service';

export interface QuizQuestion {
  question_text: string;
  question_type: 'MCQ' | 'ESSAY';
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
}

const QUIZ_OCR_PROMPT = `Kamu adalah sistem ekstraksi soal ujian.
Foto ini berisi soal-soal dari modul kuliah (mungkin pilihan ganda, essay, atau campuran).
Ekstrak SEMUA soal yang ditemukan.

Kembalikan HANYA array JSON ini (tanpa markdown backtick, tanpa penjelasan apapun):
[{
  "question_text": "Teks soal lengkap",
  "question_type": "MCQ", 
  "option_a": "Teks pilihan A atau null",
  "option_b": "Teks pilihan B atau null",
  "option_c": "Teks pilihan C atau null",
  "option_d": "Teks pilihan D atau null",
  "correct_answer": "A" atau "B" atau "C" atau "D" atau teks jawaban essay, atau "?" jika tidak ditemukan
}]

PENTING:
- Untuk "question_type", gunakan "MCQ" jika ada pilihan ganda, dan "ESSAY" jika tidak ada pilihan ganda.
- Jika "question_type" adalah "ESSAY", maka option_a sampai option_d diisi null.
- Jika tidak ada soal sama sekali, kembalikan: []`;

export class QuizService {
    
    /**
     * 1. OCR Soal Ujian (Campuran MCQ & Essay)
     */
    async importQuestionsFromImage(userId: string, subject: string, imageBuffer: Buffer, mimeType: string): Promise<number> {
        try {
            const rawResponse = await askGeminiVision(
                imageBuffer,
                mimeType,
                QUIZ_OCR_PROMPT
            );

            const cleanJsonStr = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const questions: QuizQuestion[] = JSON.parse(cleanJsonStr);

            if (!Array.isArray(questions) || questions.length === 0) {
                return 0;
            }
            
            const currentWeek = await academicService.getCurrentWeekNumber(userId);

            const insertData = questions.map(q => ({
                user_id: userId,
                subject_name: subject,
                week_number: currentWeek,
                question_text: q.question_text,
                question_type: q.question_type,
                option_a: q.option_a || null,
                option_b: q.option_b || null,
                option_c: q.option_c || null,
                option_d: q.option_d || null,
                correct_answer: q.correct_answer || '?',
                already_asked: false
            }));

            const { error } = await supabase.from('course_quiz_questions').insert(insertData);
            
            if (error) {
                console.error("DB Insert Error (course_quiz_questions):", error);
                return 0;
            }

            return questions.length;
        } catch (error) {
            console.error("Gagal melakukan OCR soal kuis:", error);
            return 0;
        }
    }

    /**
     * 2. Ambil N Soal Kuis (HANYA MCQ, yang belum pernah ditanya)
     */
    async getQuizQuestions(userId: string, subject: string, count = 5): Promise<any[]> {
        const { data, error } = await supabase
            .from('course_quiz_questions')
            .select('*')
            .eq('user_id', userId)
            .ilike('subject_name', `%${subject}%`)
            .eq('question_type', 'MCQ')
            .eq('already_asked', false)
            .limit(count);
            // Idealnya kita lakukan shuffle/random. Karena API supabase JS tidak punya .random() bawaan
            // tanpa membuat rpc custom, kita ambil beberapa lalu shuffle di memory (jika datanya kecil).
            // Tapi untuk saat ini kita limit langsung via DB.

        if (error) {
            console.error(error);
            return [];
        }

        return data || [];
    }

    /**
     * 3. Format Array Soal menjadi Teks WhatsApp
     */
    formatQuizMessage(subject: string, questions: any[], weekNumber: number): string {
        let msg = `KUIS FORMATIF - ${subject.toUpperCase()}\nMinggu ke-${weekNumber}\n\n`;

        questions.forEach((q, index) => {
            msg += `${index + 1}. ${q.question_text}\n`;
            if (q.option_a) msg += `   A. ${q.option_a}\n`;
            if (q.option_b) msg += `   B. ${q.option_b}\n`;
            if (q.option_c) msg += `   C. ${q.option_c}\n`;
            if (q.option_d) msg += `   D. ${q.option_d}\n`;
            msg += `\n`;
        });

        msg += `Jawab dengan format: jawab 1A 2B 3C ...\n(kirim semua jawaban sekaligus dalam 1 pesan)`;
        return msg.trim();
    }

    /**
     * 4. Tandai soal-soal ini sudah ditanyakan
     */
    async markQuestionsAsked(questionIds: string[]): Promise<void> {
        if (!questionIds || questionIds.length === 0) return;

        const { error } = await supabase
            .from('course_quiz_questions')
            .update({ already_asked: true, last_asked_at: new Date().toISOString() })
            .in('id', questionIds);

        if (error) {
            console.error("Error markQuestionsAsked:", error);
        }
    }

    /**
     * 5. Reset semua soal matkul ini agar bisa ditanyakan lagi
     */
    async resetAskedFlags(userId: string, subject: string): Promise<void> {
        const { error } = await supabase
            .from('course_quiz_questions')
            .update({ already_asked: false })
            .eq('user_id', userId)
            .ilike('subject_name', `%${subject}%`)
            .eq('question_type', 'MCQ');

        if (error) {
            console.error("Error resetAskedFlags:", error);
        }
    }
}

export const quizService = new QuizService();
