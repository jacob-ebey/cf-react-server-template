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

import { LoginForm } from "./login.client";
import { LoginSchema } from "./login.shared";

export default function Login() {
  type LoginState = {
    initialEmail?: string;
    initialIssues?: v.FlatErrors<any>;
  };
  const { initialEmail, initialIssues } =
    getActionState<LoginState>("login") ?? {};

  const loggedIn = !!getCookieSession("userId");

  if (loggedIn) {
    return redirect("/todo");
  }

  return (
    <main className="container w-full mx-auto px-4 md:px-6 py-16">
      <div className="typography">
        <h1>Login</h1>
      </div>
      <LoginForm
        initialEmail={initialEmail}
        initialIssues={initialIssues}
        login={async (formData) => {
          "use server";

          const { USERS } = getEnv();

          const parsed = v.safeParse(LoginSchema, Object.fromEntries(formData));
          if (!parsed.success) {
            const rawEmail = formData.get("email");

            setStatus(400);
            setActionState<LoginState>("login", {
              initialEmail: typeof rawEmail === "string" ? rawEmail : undefined,
              initialIssues: v.flatten(parsed.issues),
            });
            return;
          }

          const { email, password } = parsed.output;

          const [hashedPassword, userId] = await Promise.all([
            USERS.get(`hashedPassword:${email}`),
            USERS.get(`userId:${email}`),
          ]);

          if (
            !hashedPassword ||
            !userId ||
            !bcrypt.compareSync(password, hashedPassword)
          ) {
            setStatus(401);
            setActionState<LoginState>("login", {
              initialEmail: email,
              initialIssues: {
                nested: { email: ["Invalid email address or password."] },
              },
            });
            return;
          }

          setCookieSession("userId", userId);
          redirect("/todo");
        }}
      />
    </main>
  );
}
