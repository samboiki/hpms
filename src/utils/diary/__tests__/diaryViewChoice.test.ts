import { describe, it, expect } from 'vitest';
import { DEFAULT_DIARY_LAYOUT, readDiaryLayout, saveDiaryLayout } from '../diaryViewChoice';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
};
const refusingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota exceeded');
  }
};

describe('readDiaryLayout / saveDiaryLayout', () => {
  it('opens the time slots for someone who never chose: Eminance users expect practitioner columns', () => {
    expect(DEFAULT_DIARY_LAYOUT).toBe('timeline');
    expect(readDiaryLayout('user-1', memoryStorage())).toBe('timeline');
    expect(readDiaryLayout(null, memoryStorage())).toBe('timeline');
  });

  it("remembers each user's own choice, because one front-desk computer serves several people", () => {
    const storage = memoryStorage();
    saveDiaryLayout('user-1', 'grid', storage);
    expect(readDiaryLayout('user-1', storage)).toBe('grid');
    expect(readDiaryLayout('user-2', storage)).toBe('timeline');
  });

  it('opens the time slots when the browser blocks storage or holds something unknown', () => {
    expect(readDiaryLayout('user-1', refusingStorage)).toBe('timeline');
    expect(readDiaryLayout('user-1', null)).toBe('timeline');
    const storage = memoryStorage();
    storage.setItem('hpms:diary-layout:user-1', 'cards-v0');
    expect(readDiaryLayout('user-1', storage)).toBe('timeline');
  });

  it('never breaks the diary when the browser refuses to store the choice', () => {
    expect(() => saveDiaryLayout('user-1', 'grid', refusingStorage)).not.toThrow();
    expect(() => saveDiaryLayout(undefined, 'grid', memoryStorage())).not.toThrow();
  });
});
