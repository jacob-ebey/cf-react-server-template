import {
  destoryCookieSession,
  getActionState,
  getCookieSession,
  getEnv,
  getURL,
  redirect,
  setActionState,
} from "framework/server";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { Layout } from "./todo.client";

export default async function TodoRoute() {
  const { USER } = getEnv();
  const url = getURL();
  const createTodoListError = getActionState<string>("create-todo-list");
  const userId = getCookieSession<string>("userId");

  if (!userId) {
    return redirect("/");
  }

  const todoListId = url.pathname.replace(/^\/todo\//, "").split("/")[0];
  const todo = todoListId
    ? await USER.get(USER.idFromName(userId)).getTodoList({ id: todoListId })
    : null;

  const todos = <TodoList userId={userId} />;

  return (
    <Layout sidebar={<div className="typography p-4 md:px-6">{todos}</div>}>
      <div className="typography p-4 md:px-6 max-w-3xl w-full mx-auto">
        <h1>Todo</h1>
        <p>Todo page</p>

        <form
          action={() => {
            "use server";
            destoryCookieSession();
          }}
        >
          <p>
            <Button type="submit">Logout</Button>
          </p>
        </form>

        <form
          action={async (formData) => {
            "use server";
            const title = formData.get("title");
            if (typeof title !== "string" || !title.trim()) {
              setActionState("create-todo-list", "Please enter a title.");
              return;
            }

            const { USER } = getEnv();
            const userApi = USER.get(USER.idFromName(userId));
            const todoList = await userApi.addTodoList({ title });
            redirect(`/todo/${todoList.id}`);
          }}
        >
          <Input type="text" name="title" placeholder="Enter list name" />
          {createTodoListError && (
            <p className="text-destructive">{createTodoListError}</p>
          )}
          <Button type="submit">Create Todo List</Button>
        </form>

        {todo ? (
          <Todo id={todo.id} title={todo.title} />
        ) : (
          <>
            <h1>Select a list</h1>
            {todos}
          </>
        )}
      </div>
    </Layout>
  );
}

async function TodoList({ userId }: { userId: string }) {
  const { USER } = getEnv();
  const userApi = USER.get(USER.idFromName(userId));

  const todoLists = await userApi.listTodoLists();
  return (
    <ul>
      {todoLists.map(({ id, title }) => {
        return (
          <li key={id} className="flex items-center justify-between">
            <a href={`/todo/${id}`}>{title}</a>
            <form
              action={async () => {
                "use server";
                const { USER } = getEnv();
                const userApi = USER.get(USER.idFromName(userId));
                await userApi.deleteTodoList({ id });
                redirect("/todo");
              }}
            >
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

async function Todo({ id, title }: { id: string; title: string }) {
  const { TODO_LIST } = getEnv();
  const todoApi = TODO_LIST.get(TODO_LIST.idFromName(id));
  const todos = await todoApi.listTodos();

  return (
    <div className="typography">
      <h1>{title}</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
