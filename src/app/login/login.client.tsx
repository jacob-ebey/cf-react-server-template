"use client";

import { useId, useMemo, useTransition } from "react";
import * as v from "valibot";

import { Button } from "~/components/ui/button";
import { GlobalLoader } from "~/components/ui/global-loader";
import { ValidatedForm, ValidatedInput } from "~/components/ui/validated-form";
import { randomId } from "~/lib/utils";

import { LoginSchema } from "./login.shared";

export function LoginForm({
  initialEmail,
  initialIssues,
  login,
}: {
  initialEmail?: string;
  initialIssues?: v.FlatErrors<any>;
  login: (formData: FormData) => Promise<void>;
}) {
  const [transitioning, startTransition] = useTransition();
  const formKey = useMemo(() => randomId(), [initialIssues]);

  return (
    <>
      <GlobalLoader loading={transitioning} />
      <ValidatedForm
        key={formKey}
        className="space-y-6"
        initialIssues={initialIssues}
        schema={LoginSchema}
        validateOn="submit"
        action={login}
        onSubmit={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();

          if (transitioning) return;

          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            await login(formData);
          });
        }}
      >
        <ValidatedInput
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="current-email"
          label="Email"
          defaultValue={initialEmail}
        />

        <ValidatedInput
          name="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          label="Password"
        />

        <Button type="submit">Login</Button>

        <p className="p">
          Don't have an account?{" "}
          <a className="a" href="/signup">
            Signup here.
          </a>
        </p>
      </ValidatedForm>
    </>
  );
}
