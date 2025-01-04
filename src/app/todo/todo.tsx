import { useId } from "react";
import { Check, Loader } from "lucide-react";

import {
  getActionState,
  getCookieSession,
  getEnv,
  getURL,
  redirect,
  setActionState,
  waitToFlushUntil,
} from "framework/server";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { logoutAction } from "~/global-actions";

import { Layout } from "./todo.client";

export default async function TodoRoute() {
  const { USER } = getEnv();
  const url = getURL();
  const userId = getCookieSession<string>("userId");

  if (!userId) {
    return redirect("/");
  }

  const todoListId = url.pathname.replace(/^\/todo\//, "").split("/")[0];

  const todoList = await waitToFlushUntil(async () => {
    const todo = todoListId
      ? await USER.get(USER.idFromName(userId)).getTodoList({ id: todoListId })
      : null;
    if (!todo && todoListId) {
      return redirect("/todo");
    }

    return todo;
  });

  const todoLists = <TodoLists userId={userId} />;

  return (
    <>
      <title>{todoList ? `${todoList.title} | TODO` : "TODO"}</title>
      <Layout
        sidebar={
          <div className="p-4 md:px-6 space-y-6">
            <a href="/todo" className="p a">
              All Lists
            </a>
            {todoLists}
          </div>
        }
      >
        <div className="p-4 md:px-6 max-w-3xl w-full mx-auto">
          {todoList ? (
            <TodoList todoListId={todoList.id} title={todoList.title} />
          ) : (
            <div className="space-y-20">
              <NewTodoListForm userId={userId} />
              {todoLists}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

async function TodoLists({ userId }: { userId: string }) {
  const { USER } = getEnv();
  const userApi = USER.get(USER.idFromName(userId));

  const todoLists = await userApi.listTodoLists();
  return todoLists.length > 0 ? (
    <ul className="!p-0 space-y-6">
      {todoLists.map(({ id, title }) => {
        return (
          <li key={id} className="flex items-center justify-between">
            <a href={`/todo/${id}`} className="a">
              {title}
            </a>
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
  ) : (
    <p className="p">No lists yet.</p>
  );
}

function NewTodoListForm({ userId }: { userId: string }) {
  const createTodoListError = getActionState<string>("create-todo-list");
  const titleErrorId = useId();

  return (
    <form
      className="flex flex-col space-y-6"
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
      <label className="w-full">
        <span className="sr-only">New list name</span>
        <Input
          className="w-full"
          type="text"
          name="title"
          placeholder="Enter list name"
          aria-describedby={titleErrorId}
        />
      </label>
      {createTodoListError ? (
        <p id={titleErrorId} className="text-destructive">
          {createTodoListError}
        </p>
      ) : null}
      <Button type="submit">Create Todo List</Button>
    </form>
  );
}

async function TodoList({
  todoListId,
  title,
}: {
  todoListId: string;
  title: string;
}) {
  const { TODO_LIST } = getEnv();
  const todoListApi = TODO_LIST.get(TODO_LIST.idFromName(todoListId));
  const todos = await todoListApi.listTodos();

  return (
    <div className="space-y-6">
      <h1 className="h1">{title}</h1>

      <AddTodoForm todoListId={todoListId} />

      <ul className="space-y-6 mt-20">
        {todos.map(({ id, text, completed }) => (
          <li key={id} className="flex items-center justify-between">
            <form
              action={async () => {
                "use server";
                const { TODO_LIST } = getEnv();
                const todoListApi = TODO_LIST.get(
                  TODO_LIST.idFromName(todoListId)
                );
                await todoListApi.updateTodo({ id, completed: !completed });
              }}
            >
              <Button type="submit" size="icon">
                {completed ? (
                  <>
                    <span className="sr-only">
                      Completed (click to set uncompleted)
                    </span>
                    <Check />
                  </>
                ) : (
                  <>
                    <span className="sr-only">
                      Uncompleted (click to set completed)
                    </span>
                    <Loader />
                  </>
                )}
              </Button>
            </form>
            <div>{text}</div>
            <form
              action={async () => {
                "use server";
                const { TODO_LIST } = getEnv();
                const todoListApi = TODO_LIST.get(
                  TODO_LIST.idFromName(todoListId)
                );
                await todoListApi.deleteTodo({ id });
              }}
            >
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddTodoForm({ todoListId }: { todoListId: string }) {
  const createTodoError = getActionState<string>("create-todo");
  const textErrorId = useId();

  return (
    <form
      className="flex flex-col space-y-6"
      action={async (formData) => {
        "use server";
        const text = formData.get("text");
        if (typeof text !== "string" || !text.trim()) {
          setActionState("create-todo-list", "Please enter a todo.");
          return;
        }

        const { TODO_LIST } = getEnv();
        const todoListApi = TODO_LIST.get(TODO_LIST.idFromName(todoListId));
        await todoListApi.addTodo({ text });
      }}
    >
      <label className="w-full">
        <span className="sr-only">What do you need to do?</span>
        <Input
          className="w-full"
          type="text"
          name="text"
          placeholder="What do you need to do?"
          aria-describedby={textErrorId}
        />
      </label>
      {createTodoError ? (
        <p id={textErrorId} className="text-destructive">
          {createTodoError}
        </p>
      ) : null}
      <Button type="submit">Add Todo</Button>
    </form>
  );
}
