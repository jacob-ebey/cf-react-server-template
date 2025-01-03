import {
  destoryCookieSession,
  getCookieSession,
  redirect,
} from "framework/server";

export default function Dashboard() {
  const loggedIn = !!getCookieSession("userId");

  if (!loggedIn) {
    return redirect("/");
  }

  return (
    <main className="container w-full mx-auto px-4 md:px-6 py-16">
      <div className="typography">
        <h1>Dashboard</h1>
        <p>You are logged in.</p>
        <form
          action={() => {
            "use server";
            destoryCookieSession();
          }}
        >
          <button type="submit">Logout</button>
        </form>
      </div>
    </main>
  );
}
