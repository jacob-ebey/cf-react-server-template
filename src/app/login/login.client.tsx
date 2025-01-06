"use client";

import { useTransition } from "react";
import * as v from "valibot";

import { Button } from "~/components/ui/button";
import { GlobalLoader } from "~/components/ui/global-loader";
import { ValidatedForm, ValidatedInput } from "~/components/ui/validated-form";

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
  const [loggingIn, startLoggingIn] = useTransition();

  return (
    <>
      <GlobalLoader loading={loggingIn} />
      <ValidatedForm
        className="space-y-6"
        initialIssues={initialIssues}
        schema={LoginSchema}
        validateOn="submit"
        action={login}
        onSubmit={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();

          if (loggingIn) return;

          const formData = new FormData(event.currentTarget);
          startLoggingIn(async () => {
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
