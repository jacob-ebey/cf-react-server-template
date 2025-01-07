import { Outlet } from "framework/react-router.client";

export async function Component() {
  await new Promise((resolve) => setTimeout(resolve, 200));

  return (
    <main className="typography py-20 px-4 md:px-6 mx-auto w-full container">
      <h1>Server Route!</h1>
      <p>
        <a href="/">Home</a>
      </p>
      <p>
        <a href="/server">Server</a>
      </p>
      <p>
        <a href="/server/param">Sub</a>
      </p>

      <Outlet />
    </main>
  );
}
