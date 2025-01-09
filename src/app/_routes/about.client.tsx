"use client";

import { useHydrated } from "framework/client";
import {
  Link,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useMatches,
  useNavigation,
  useParams,
} from "react-router";
import { Button } from "~/components/ui/button";

export function Component() {
  const hydrated = useHydrated();
  const location = useLocation();
  const matches = useMatches();
  const params = useParams();
  const navigation = useNavigation();
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  return (
    <main className="typography py-20 px-4 md:px-6 mx-auto w-full container">
      <h1>About!</h1>
      <p>
        <Link to="/">Home</Link>
      </p>
      <p>
        <Link to="/about">About</Link>
      </p>
      <p>
        <Link to="/about/param">Sub</Link>
      </p>

      <p>Loader Data:</p>
      <pre>
        <code>{JSON.stringify(loaderData, null, 2)}</code>
      </pre>

      <p>Params:</p>
      <pre>
        <code>{JSON.stringify(params, null, 2)}</code>
      </pre>

      <p>Navigation</p>
      <pre>
        <code>{JSON.stringify(navigation, null, 2)}</code>
      </pre>

      <p>Location:</p>
      <pre>
        <code>
          {JSON.stringify(
            hydrated
              ? (({ key, hash, ...rest }) => ({ ...rest, hash, key }))(location)
              : (({ key, hash, ...rest }) => rest)(location),
            null,
            2
          )}
        </code>
      </pre>

      <p>Matches:</p>
      <pre>
        <code>{JSON.stringify(matches, null, 2)}</code>
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
          {JSON.stringify(
            {
              state: fetcher.state,
              data: fetcher.data,
            },
            null,
            2
          )}
        </code>
      </pre>

      <Outlet />
    </main>
  );
}
