import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, RotateCcw, BookOpen } from 'lucide-react';
import { apiFetch } from '../utils/helpers';
import { LoadingState, ErrorState } from '../components/StateComponents';

interface Question {
  id: string;
  question: string;
  options: string[];
  explanation: string;
}

interface LessonDetail {
  id: string;
  title: string;
  content: string;
  slug: string;
  questions: Question[];
  quizResult?: { score: number; total: number } | null;
}

interface QuizResultDetail {
  question: string;
  options: string[];
  correctIndex: number;
  userAnswer: number;
  isCorrect: boolean;
  explanation: string;
}

export default function LessonDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResultDetail[] | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const loadLesson = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/learn/lessons/${slug}`);
      if (!res.ok) throw new Error('Lesson not found');
      const data = await res.json();
      setLesson(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  if (loading) return <LoadingState text="Loading lesson..." height="h-screen" />;
  if (error || !lesson) return <ErrorState message={error || 'Lesson not found'} onRetry={loadLesson} />;

  const allAnswered = lesson.questions.every((q, i) => answers[i] !== undefined);

  const submitQuiz = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/learn/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: lesson.id,
          answers: lesson.questions.map((_, i) => answers[i])
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.results);
      setScore(data.score);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/learn')}
        className="btn-secondary text-sm inline-flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Lessons
      </button>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="badge bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Lesson
          </span>
          {lesson.quizResult && (
            <span className="badge bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400">
              <Trophy className="w-3.5 h-3.5 mr-1" /> Best: {lesson.quizResult.score}/{lesson.quizResult.total}
            </span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">{lesson.title}</h1>
        <div className="prose prose-sm prose-blue dark:prose-invert max-w-none">
          <ReactMarkdown>{lesson.content}</ReactMarkdown>
        </div>
      </div>

      {lesson.questions.length > 0 && (
        <div className="card">
          <h2 className="section-title">Quick Quiz</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Test your understanding of this lesson. Score 100% to earn a badge ({lesson.quizResult ? `Previous best: ${lesson.quizResult.score}/${lesson.quizResult.total}` : 'No attempts yet'}).
          </p>

          <div className="space-y-6">
            {lesson.questions.map((q, qIndex) => {
              const selected = answers[qIndex];
              const isWrong = result && !result[qIndex]?.isCorrect;
              return (
                <div key={q.id} className="space-y-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {qIndex + 1}. {q.question}
                  </h3>
                  <div className="space-y-2">
                    {q.options.map((option, oIndex) => {
                      let style = 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-primary-500';
                      if (!result && selected === oIndex) {
                        style = 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300';
                      }
                      if (result && result[qIndex].correctIndex === oIndex) {
                        style = 'border-success bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400';
                      }
                      if (result && !result[qIndex].isCorrect && selected === oIndex) {
                        style = 'border-danger bg-danger-light dark:bg-danger/10 text-danger-dark dark:text-red-400';
                      }
                      return (
                        <button
                          key={oIndex}
                          disabled={!!result}
                          onClick={() => setAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${style}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{option}</span>
                            {result && result[qIndex].correctIndex === oIndex && (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
                            )}
                            {result && !result[qIndex].isCorrect && selected === oIndex && (
                              <XCircle className="w-4 h-4 shrink-0 text-danger" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {result && (
                    <p className={`text-sm ${result[qIndex].isCorrect ? 'text-success-dark dark:text-emerald-400' : 'text-warning-dark dark:text-amber-400'}`}>
                      {result[qIndex].isCorrect ? '✓ Correct! ' : '✗ Incorrect. '}
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!result && (
            <button
              onClick={submitQuiz}
              disabled={!allAnswered || submitting}
              className="btn-primary w-full mt-6"
            >
              {submitting ? 'Checking...' : allAnswered ? 'Check Answers' : `Answer all questions (${Object.keys(answers).length}/${lesson.questions.length})`}
            </button>
          )}

          {result && score !== null && (
            <div className={`mt-6 p-6 rounded-2xl text-center animate-fade-in ${
              score === lesson.questions.length
                ? 'bg-success-light dark:bg-success/10'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              {score === lesson.questions.length ? (
                <>
                  <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Perfect Score!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    You got {score}/{lesson.questions.length} correct. Badge earned!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    You scored {score}/{lesson.questions.length}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {score >= lesson.questions.length * 0.7 ? 'Great job! Review and aim for a perfect score.' : 'Review the lesson and try again for a perfect score.'}
                  </p>
                </>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => { setResult(null); setScore(null); setAnswers({}); }} className="btn-secondary inline-flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Retry Quiz
                </button>
                <Link to="/learn" className="btn-primary">Browse More Lessons</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
