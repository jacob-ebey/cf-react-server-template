import { Suspense } from "react";
import { Check, Loader } from "lucide-react";
import * as v from "valibot";

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

import {
  AddTodoForm,
  CreateTodoListForm,
  Layout,
  TodoListItem,
} from "./todo.client";
import { AddTodoSchema, CreateTodoListSchema } from "./todo.shared";
import { GlobalLoader } from "~/components/ui/global-loader";

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
            <Suspense fallback={<GlobalLoader loading />}>{todoLists}</Suspense>
          </div>
        }
      >
        <div className="p-4 md:px-6 max-w-3xl w-full mx-auto">
          {todoList ? (
            <TodoList todoListId={todoList.id} title={todoList.title} />
          ) : (
            <div className="space-y-20">
              <CreateTodoListForm
                initialIssues={getActionState<v.FlatErrors<any>>(
                  "create-todo-list"
                )}
                create={async (formData) => {
                  "use server";

                  const parsed = v.safeParse(
                    CreateTodoListSchema,
                    Object.fromEntries(formData)
                  );
                  if (!parsed.success) {
                    setActionState(
                      "create-todo-list",
                      v.flatten(parsed.issues)
                    );
                    return;
                  }

                  const { title } = parsed.output;

                  const { USER } = getEnv();
                  const userApi = USER.get(USER.idFromName(userId));
                  const todoList = await userApi.addTodoList({ title });
                  redirect(`/todo/${todoList.id}`);
                }}
              />

              <Suspense fallback={<GlobalLoader loading />}>
                {todoLists}
              </Suspense>
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
          <TodoListItem
            key={id}
            id={id}
            title={title}
            delete={async () => {
              "use server";
              const { USER } = getEnv();
              const userApi = USER.get(USER.idFromName(userId));
              await userApi.deleteTodoList({ id });
              redirect("/todo");
            }}
          />
        );
      })}
    </ul>
  ) : (
    <p className="p">No lists yet.</p>
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

      <AddTodoForm
        initialIssues={getActionState<v.FlatErrors<any>>("add-todo")}
        add={async (formData) => {
          "use server";

          const parsed = v.safeParse(
            AddTodoSchema,
            Object.fromEntries(formData)
          );

          if (!parsed.success) {
            setActionState("add-todo", v.flatten(parsed.issues));
            return;
          }

          const { text } = parsed.output;

          const { TODO_LIST } = getEnv();
          const todoListApi = TODO_LIST.get(TODO_LIST.idFromName(todoListId));
          await todoListApi.addTodo({ text });
        }}
      />

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
