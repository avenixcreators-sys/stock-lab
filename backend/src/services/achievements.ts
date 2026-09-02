import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';

export function checkAndAwardBadges(userId: string): string[] {
  const badges = [
    { id: 'first-lesson', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(userId) as any;
      return count.c >= 1;
    }},
    { id: 'five-lessons', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(userId) as any;
      return count.c >= 5;
    }},
    { id: 'ten-lessons', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(userId) as any;
      return count.c >= 10;
    }},
    { id: 'all-lessons', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(userId) as any;
      return count.c >= 12;
    }},
    { id: 'first-trade', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?').get(userId) as any;
      return count.c >= 1;
    }},
    { id: 'diversified', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT symbol) as c FROM holdings WHERE user_id = ? AND quantity > 0').get(userId) as any;
      return count.c >= 5;
    }},
    { id: 'watchlist-tracker', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM watchlist WHERE user_id = ?').get(userId) as any;
      return count.c >= 3;
    }},
    { id: 'portfolio-builder', check: () => {
      const count = db.prepare('SELECT COUNT(DISTINCT symbol) as c FROM holdings WHERE user_id = ? AND quantity > 0').get(userId) as any;
      return count.c >= 1;
    }}
  ];

  const insertBadge = db.prepare('INSERT OR IGNORE INTO achievements (id, user_id, badge_id) VALUES (?, ?, ?)');
  const awarded: string[] = [];
  for (const badge of badges) {
    if (badge.check()) {
      const result = insertBadge.run(uuidv4(), userId, badge.id);
      if (result.changes > 0) awarded.push(badge.id);
    }
  }
  return awarded;
}