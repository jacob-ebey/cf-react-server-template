import {
  destoryCookieSession,
  getCookieSession,
  redirect,
} from "framework/server";
import { Button } from "~/components/ui/button";

export default function Todo() {
  const loggedIn = !!getCookieSession("userId");

  if (!loggedIn) {
    return redirect("/");
  }

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
      </div>
    </main>
  );
}
