"use client";

import {
  Link,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
  useParams,
} from "react-router";
import { Button } from "~/components/ui/button";

export function Component() {
  const location = useLocation();
  const params = useParams();
  const navigation = useNavigation();
  const loaderData = useLoaderData();

  const fetcher = useFetcher();

  return (
    <main className="typography py-20 px-4 md:px-6 mx-auto w-full container">
      <h1>Home!</h1>
      <p>
        <Link to="/about">About</Link>
      </p>
      <p>
        <Link to="/server">Server</Link>
      </p>
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

      <p>Fetcher:</p>
      <p>
        <Button
          type="button"
          onPress={() => {
            fetcher.load(".");
          }}
        >
          Load fetcher
        </Button>
      </p>
      <pre>
        <code>
          {JSON.stringify({
            state: fetcher.state,
            data: fetcher.data || null,
          })}
        </code>
      </pre>
    </main>
  );
}
