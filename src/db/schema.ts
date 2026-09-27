import Dexie, { type Table } from 'dexie';

export type WordGroup = 1 | 2 | 3 | 4;
export type SessionMode = 'general' | 'daily' | 'mastered';

export interface Word {
  id?: number;
  term: string;
  normalizedTerm: string;
  meanings: string[];
  partOfSpeech?: string;
  exampleEn?: string;
  status: 'new' | 'tested';
  group: WordGroup | null;
  createdAt: number;
  lastTestedAt: number | null;
  testCount: number;
  wrongCount: number;
}

export type StoredWord = Word & { id: number };

export interface Attempt {
  id?: number;
  wordId: number;
  sessionId: string;
  mode: SessionMode;
  pron: {
    correct: boolean;
    heard: string;
    method: 'webspeech' | 'gemini' | 'self';
    overridden: boolean;
  };
  meaning: {
    correct: boolean;
    transcript: string;
    method: 'match' | 'gemini' | 'self';
    overridden: boolean;
  };
  invalidRetries: number;
  prevGroup: WordGroup | null;
  newGroup: WordGroup;
  at: number;
}

export interface Session {
  id: string;
  mode: SessionMode;
  dailyDate?: string;
  wordIds: number[];
  doneWordIds: number[];
  status: 'active' | 'done';
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class KelimeDatabase extends Dexie {
  words!: Table<Word, number>;
  attempts!: Table<Attempt, number>;
  sessions!: Table<Session, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'kelime-hafizam') {
    super(name);
    this.version(1).stores({
      words: '++id,&normalizedTerm,status,group,lastTestedAt',
      attempts: '++id,wordId,sessionId,at',
      sessions: 'id,mode,[mode+dailyDate],status',
      settings: 'key',
    });
  }
}

export const db = new KelimeDatabase();
