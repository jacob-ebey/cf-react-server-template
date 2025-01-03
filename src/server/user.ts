import { DurableObject } from "cloudflare:workers";

export type TodoList = {
  id: string;
  title: string;
  created_at: string;
};

function rowToTodoList(row: any): TodoList {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
  };
}

export class User extends DurableObject {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    this.sql = state.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS todo_lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  addTodoList({ title }: { title: string }) {
    const todoList = {
      id: crypto.randomUUID(),
      title,
      created_at: new Date().toISOString(),
    };
    this.sql.exec(
      "INSERT INTO todo_lists (id, title, created_at) VALUES (?, ?, ?)",
      todoList.id,
      todoList.title,
      todoList.created_at
    );
    return todoList;
  }

  listTodoLists() {
    const results = this.sql
      .exec("SELECT * FROM todo_lists ORDER BY created_at DESC")
      .toArray();
    return results.map(rowToTodoList);
  }

  updateTodoList({ id, title }: { id: string; title: string }): boolean {
    const result = this.sql.exec(
      "UPDATE todo_lists SET title = ? WHERE id = ?",
      title,
      id
    );
    return result.rowsWritten === 1;
  }

  deleteTodoList({ id }: { id: string }): boolean {
    const result = this.sql.exec("DELETE FROM todo_lists WHERE id = ?", id);
    return result.rowsWritten === 1;
  }
}
