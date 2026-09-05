import { Router } from 'express';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  getQuizResult,
  saveQuizResult,
  getAchievements,
  countCompletedLessons,
  computeAndAwardBadges,
} from '../services/firestoreStore.js';

const router = Router();

router.get('/lessons', (_req, res) => {
  try {
    const lessons = db.prepare('SELECT id, title, slug, category, order_index FROM lessons ORDER BY order_index').all();
    res.json(lessons);
  } catch (error) {
    console.error('Lessons error:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

router.get('/lessons/:slug', async (req: AuthRequest, res) => {
  try {
    const { slug } = req.params;
    const lesson = db.prepare('SELECT * FROM lessons WHERE slug = ?').get(slug) as any;

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const questions = db.prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY order_index')
      .all(lesson.id).map((q: any) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        explanation: q.explanation
      }));

    let quizResult = null;
    if (req.userId) {
      const result = await getQuizResult(req.userId, lesson.id);
      if (result) {
        quizResult = { score: result.score, total: result.total, completed_at: null };
      }
    }

    res.json({
      ...lesson,
      questions,
      quizResult
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Lesson detail error:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

router.post('/quiz/submit', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { lessonId, answers } = req.body;

    if (!lessonId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Lesson ID and answers array required' });
    }

    const questions = db.prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY order_index')
      .all(lessonId) as any[];

    if (questions.length === 0) {
      return res.status(404).json({ error: 'No questions found for this lesson' });
    }

    let score = 0;
    const results = questions.map((q: any, i: number) => {
      const userAnswer = answers[i];
      const isCorrect = userAnswer === q.correct_index;
      if (isCorrect) score++;

      return {
        questionId: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        correctIndex: q.correct_index,
        userAnswer,
        isCorrect,
        explanation: q.explanation
      };
    });

    await saveQuizResult(userId, lessonId, score, questions.length);

    const awarded = await computeAndAwardBadges(userId);

    res.json({ score, total: questions.length, results, newlyAwardedBadges: awarded });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Quiz submit error:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

router.get('/achievements', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const achievements = await getAchievements(userId);
    const completedLessons = await countCompletedLessons(userId);

    res.json({
      achievements: achievements.map((a) => ({
        badgeId: a.badgeId,
        earned_at: a.unlockedAt,
      })),
      completedLessons,
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

export default router;
