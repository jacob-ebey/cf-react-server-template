import * as v from "valibot";

const invalidEmailMessage = "Invalid email address.";
const invalidPasswordMessage = "Password is required.";

export const LoginSchema = v.object({
  email: v.pipe(v.string(), v.email(invalidEmailMessage)),
  password: v.pipe(v.string(), v.nonEmpty(invalidPasswordMessage)),
});
