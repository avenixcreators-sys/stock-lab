import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import { checkAndAwardBadges } from '../services/achievements.js';

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

router.get('/lessons/:slug', (req: AuthRequest, res) => {
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
      quizResult = db.prepare('SELECT score, total, completed_at FROM quiz_results WHERE user_id = ? AND lesson_id = ? ORDER BY completed_at DESC LIMIT 1')
        .get(req.userId, lesson.id);
    }

    res.json({
      ...lesson,
      questions,
      quizResult
    });
  } catch (error) {
    console.error('Lesson detail error:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

router.post('/quiz/submit', (req: AuthRequest, res) => {
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

    db.prepare('INSERT INTO quiz_results (id, user_id, lesson_id, score, total) VALUES (?, ?, ?, ?, ?)')
      .run(require('uuid').v4(), userId, lessonId, score, questions.length);

    if (score === questions.length) {
      checkAndAwardBadges(userId);
    }

    const awarded = checkAndAwardBadges(userId);

    res.json({ score, total: questions.length, results, newlyAwardedBadges: awarded });
  } catch (error) {
    console.error('Quiz submit error:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

router.get('/achievements', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const achievements = db.prepare('SELECT badge_id, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC')
      .all(userId);
    const completedLessons = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0')
      .get(userId) as any;
    res.json({
      achievements,
      completedLessons: completedLessons.c
    });
  } catch (error) {
    console.error('Achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

export default router;
