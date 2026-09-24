import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Row, Sql } from './gallery.ts';

// The gallery's SQL on the local Node server: one SQLite file, same statements as D1.

export function sqliteSql(path: string): Sql {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  const values = (params: unknown[]) => params as SQLInputValue[];
  return {
    all: async (sql, ...params) => db.prepare(sql).all(...values(params)) as Row[],
    first: async (sql, ...params) => (db.prepare(sql).get(...values(params)) as Row | undefined) ?? null,
    run: async (sql, ...params) => {
      db.prepare(sql).run(...values(params));
    },
  };
}
