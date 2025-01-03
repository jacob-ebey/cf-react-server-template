import {
  destoryCookieSession,
  getActionState,
  getCookieSession,
  getEnv,
  redirect,
  setActionState,
} from "framework/server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default async function Todo() {
  const { USER } = getEnv();
  const createTodoListError = getActionState<string>("create-todo-list");
  const userId = getCookieSession<string>("userId");

  if (!userId) {
    return redirect("/");
  }

  const userApi = USER.get(USER.idFromName(userId));
  const todoLists = await userApi.listTodoLists();

  return (
    <main className="container w-full mx-auto px-4 md:px-6 py-16">
      <div className="typography">
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

        <ul>
          {todoLists.map(({ id, title }) => {
            return (
              <li key={id}>
                <a href={`/todo/${id}`}>{title}</a>
                <form
                  action={async () => {
                    "use server";
                    const { USER } = getEnv();
                    const userApi = USER.get(USER.idFromName(userId));
                    await userApi.deleteTodoList({ id });
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
      </div>
    </main>
  );
}
