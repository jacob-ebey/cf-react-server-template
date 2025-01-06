import * as v from "valibot";

export const AddTodoSchema = v.object({
  text: v.pipe(v.string(), v.trim(), v.nonEmpty("Text is required")),
});

export const CreateTodoListSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.nonEmpty("Title is required")),
});
