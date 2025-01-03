"use client";

import { useId, useMemo, useTransition } from "react";
import * as v from "valibot";

import { Button } from "~/components/ui/button";
import { GlobalLoader } from "~/components/ui/global-loader";
import { ValidatedForm, ValidatedInput } from "~/components/ui/validated-form";
import { randomId } from "~/lib/utils";

import { SignupSchema } from "./signup.shared";

export function SignupForm({
  initialEmail,
  initialIssues,
  signup,
}: {
  initialEmail?: string;
  initialIssues?: v.FlatErrors<any>;
  signup: (formData: FormData) => Promise<void>;
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
        schema={SignupSchema}
        validateOn="submit"
        action={signup}
        onSubmit={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();

          if (transitioning) return;

          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            await signup(formData);
          });
        }}
      >
        <ValidatedInput
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          label="Email"
          defaultValue={initialEmail}
        />

        <ValidatedInput
          name="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="new-password"
          label="Password"
        />

        <ValidatedInput
          name="verifyPassword"
          type="password"
          placeholder="Verify your password"
          autoComplete="new-password"
          label="Verify Password"
        />

        <Button type="submit">Signup</Button>

        <p className="p">
          Already have an account?{" "}
          <a className="a" href="/">
            Login here.
          </a>
        </p>
      </ValidatedForm>
    </>
  );
}
