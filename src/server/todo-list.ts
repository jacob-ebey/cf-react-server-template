import { DurableObject } from "cloudflare:workers";

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
};

export type UpdateTodoParams = {
  id: string;
  text?: string;
  completed?: boolean;
};

export type AddTodoParams = {
  text: string;
};

function rowToTodo(row: any) {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    created_at: row.created_at,
  };
}

export class TodoList extends DurableObject {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    this.sql = state.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL
      );
    `);
  }

  listTodos(): Todo[] {
    const results = this.sql
      .exec("SELECT * FROM todos ORDER BY created_at DESC")
      .toArray();
    return results.map(rowToTodo);
  }

  addTodo({ text }: AddTodoParams): Todo | null {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      created_at: new Date().toISOString(),
    };

    const result = this.sql.exec(
      "INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, ?, ?)",
      todo.id,
      todo.text,
      todo.completed,
      todo.created_at
    );

    return result.rowsWritten === 1 ? todo : null;
  }

  updateTodo({ id, text, completed }: UpdateTodoParams): boolean {
    const existing = this.sql.exec("SELECT * FROM todos WHERE id = ?").one();

    if (!existing) {
      return false;
    }

    const values = rowToTodo(existing);
    const newValues: Todo = {
      ...values,
      text: text ?? values.text,
      completed: completed ?? values.completed,
    };

    const result = this.sql.exec(
      "UPDATE todos SET text = ?, completed = ? WHERE id = ?",
      newValues.text,
      newValues.completed,
      id
    );

    return result.rowsWritten === 1;
  }

  deleteTodo(id: string): boolean {
    const result = this.sql.exec("DELETE FROM todos WHERE id = ?", id);

    return result.rowsWritten === 1;
  }

  getTodo(id: string): Todo | null {
    const todo = this.sql
      .exec("SELECT * FROM todos WHERE id = ?", id)
      .one() as unknown as Todo | null;

    return todo ? rowToTodo(todo) : null;
  }
}
