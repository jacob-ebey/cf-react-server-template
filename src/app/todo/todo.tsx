import { Suspense } from "react";
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

import { GlobalLoader } from "~/components/ui/global-loader";
import {
  AddTodoForm,
  CreateTodoListForm,
  Layout,
  TodoItem,
  TodoListItem,
} from "./todo.client";
import { AddTodoSchema, CreateTodoListSchema } from "./todo.shared";

export default async function TodoRoute() {
  const { TODO_LIST, USER } = getEnv();
  const url = getURL();
  const userId = getCookieSession<string>("userId");

  if (!userId) {
    return redirect("/");
  }

  const todoListId = url.pathname.replace(/^\/todo\//, "").split("/")[0];

  const [todoList, todos] = await waitToFlushUntil(async () => {
    const todoList = todoListId
      ? USER.get(USER.idFromName(userId)).getTodoList({ id: todoListId })
      : null;

    const todoListApi = todoListId
      ? TODO_LIST.get(TODO_LIST.idFromName(todoListId))
      : null;
    const todos = todoListApi ? todoListApi.listTodos() : null;

    return Promise.all([todoList, todos]);
  });

  if (!todoList && todoListId) {
    return redirect("/todo");
  }

  const todoLists = <TodoLists key={userId} userId={userId} />;

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
            // <TodoListRoute todoListId={todoList.id} title={todoList.title} />
            <div className="space-y-6">
              <h1 className="h1">{todoList.title}</h1>

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
                  const todoListApi = TODO_LIST.get(
                    TODO_LIST.idFromName(todoListId!)
                  );
                  await todoListApi.addTodo({ text });
                }}
              />

              <ul className="space-y-6 mt-20">
                {todos?.map(({ id, text, completed }) => (
                  <TodoItem
                    key={id}
                    completed={completed}
                    text={text}
                    delete={async () => {
                      "use server";
                      const { TODO_LIST } = getEnv();
                      const todoListApi = TODO_LIST.get(
                        TODO_LIST.idFromName(todoListId!)
                      );
                      await todoListApi.deleteTodo({ id });
                    }}
                    toggle={async () => {
                      "use server";
                      const { TODO_LIST } = getEnv();
                      const todoListApi = TODO_LIST.get(
                        TODO_LIST.idFromName(todoListId!)
                      );
                      await todoListApi.updateTodo({
                        id,
                        completed: !completed,
                      });
                    }}
                  />
                ))}
              </ul>
            </div>
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
