import * as bcrypt from "bcrypt-edge";
import * as v from "valibot";

import {
  getActionState,
  getCookieSession,
  getEnv,
  redirect,
  setActionState,
  setCookieSession,
  setStatus,
} from "framework/server";

import { SignupForm } from "./signup.client";
import { SignupSchema } from "./signup.shared";

export default function Signup() {
  type SignupState = {
    initialEmail?: string;
    initialIssues?: v.FlatErrors<any>;
  };
  const { initialEmail, initialIssues } =
    getActionState<SignupState>("signup") ?? {};

  const loggedIn = !!getCookieSession("userId");

  if (loggedIn) {
    return redirect("/dashboard");
  }

  return (
    <main className="container w-full mx-auto px-4 md:px-6 py-16">
      <div className="typography">
        <h1 className="h1">Signup</h1>
      </div>
      <SignupForm
        initialEmail={initialEmail}
        initialIssues={initialIssues}
        signup={async (formData) => {
          "use server";

          const { USERS } = getEnv();

          const parsed = v.safeParse(
            SignupSchema,
            Object.fromEntries(formData)
          );
          if (!parsed.success) {
            const rawEmail = formData.get("email");

            setStatus(400);
            setActionState<SignupState>("signup", {
              initialEmail: typeof rawEmail === "string" ? rawEmail : undefined,
              initialIssues: v.flatten(parsed.issues),
            });
            return;
          }

          const { email, password } = parsed.output;

          const existingUserId = await USERS.get(`userId:${email}`);

          if (existingUserId) {
            setStatus(401);
            setActionState<SignupState>("signup", {
              initialEmail: email,
              initialIssues: {
                nested: { email: ["Invalid email address or password."] },
              },
            });
            return;
          }

          const userId = crypto.randomUUID();
          await Promise.all([
            USERS.put(`hashedPassword:${email}`, bcrypt.hashSync(password, 12)),
            USERS.put(`userId:${email}`, userId),
          ]);

          setCookieSession("userId", userId);
          redirect("/dashboard");
        }}
      />
    </main>
  );
}
