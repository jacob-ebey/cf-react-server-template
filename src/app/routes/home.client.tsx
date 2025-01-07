"use client";

import {
  Link,
  useLoaderData,
  useLocation,
  useParams,
  useNavigation,
} from "react-router";

export function Component() {
  const location = useLocation();
  const params = useParams();
  const navigation = useNavigation();
  const loaderData = useLoaderData();

  return (
    <main className="typography py-20 px-4 md:px-6 mx-auto w-full container">
      <h1>Home!</h1>
      <Link to="/about">About</Link>
      <p>Location:</p>
      <pre>
        <code>{JSON.stringify(location)}</code>
      </pre>

      <p>Params:</p>
      <pre>
        <code>{JSON.stringify(params)}</code>
      </pre>

      <p>Navigation</p>
      <pre>
        <code>{JSON.stringify(navigation)}</code>
      </pre>

      <p>Loader Data:</p>
      <pre>
        <code>{JSON.stringify(loaderData)}</code>
      </pre>
    </main>
  );
}
