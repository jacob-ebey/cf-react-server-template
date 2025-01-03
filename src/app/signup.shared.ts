import * as v from "valibot";

const invalidEmailMessage = "Invalid email address.";
const invalidPasswordMessage = "Password is required.";
const invalidVerifyPasswordMessage = "Passwords do not match.";

export const SignupSchema = v.pipe(
  v.object({
    email: v.pipe(v.string(), v.email(invalidEmailMessage)),
    password: v.pipe(v.string(), v.nonEmpty(invalidPasswordMessage)),
    verifyPassword: v.pipe(v.string(), v.nonEmpty(invalidPasswordMessage)),
  }),
  v.forward(
    v.check(
      ({ password, verifyPassword }) => password === verifyPassword,
      invalidVerifyPasswordMessage
    ),
    ["verifyPassword"]
  )
);
