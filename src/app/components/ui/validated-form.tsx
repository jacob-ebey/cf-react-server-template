import { Slot } from "@radix-ui/react-slot";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import * as v from "valibot";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

type FormState = {
  // biome-ignore lint/suspicious/noExplicitAny: bla bla bla
  issues?: v.FlatErrors<any>;
  reflowListeners: Set<() => void>;
};

const formContext = createContext({
  id: null as null | string,
  forms: {} as Record<string, FormState>,
});

export function useFormState(_id?: string) {
  const [, reflow] = useState({});
  const ctx = use(formContext);
  const id = typeof _id === "string" ? _id : ctx.id;
  const form = typeof id === "string" ? ctx.forms[id] : null;
  if (form == null) {
    throw new Error("Form state not found");
  }

  useEffect(() => {
    const callback = () => reflow({});
    form.reflowListeners.add(callback);
    return () => {
      form.reflowListeners.delete(callback);
    };
  }, [form]);

  return form;
}

export type ValidateEvent = "blur" | "change" | "submit";

export type ValidatedFormProps<
  TEntries extends v.ObjectEntries,
  TMessage extends v.ErrorMessage<v.ObjectIssue> | undefined
> = React.ComponentProps<"form"> & {
  asChild?: boolean;
  initialIssues?: v.FlatErrors<any>;
  schema:
    | v.ObjectSchema<TEntries, TMessage>
    | v.SchemaWithPipe<[v.ObjectSchema<TEntries, TMessage>, ...rest: any[]]>;
  validateOn?: ValidateEvent | ValidateEvent[];
};

export function ValidatedForm<
  TEntries extends v.ObjectEntries,
  TMessage extends v.ErrorMessage<v.ObjectIssue> | undefined
>({
  asChild,
  id: _id,
  initialIssues,
  onBlur,
  onChange,
  onSubmit,
  schema,
  validateOn = "submit",
  ...props
}: ValidatedFormProps<TEntries, TMessage>) {
  const Comp = asChild ? Slot : "form";
  const __id = useId();
  const id = typeof _id === "string" ? _id : __id;

  const ctx = use(formContext);

  const instanceCtx = useMemo(
    () => ({
      ...ctx,
      id,
    }),
    [id, ctx]
  );
  if (!instanceCtx.forms[id]) {
    instanceCtx.forms[id] = {
      issues: initialIssues,
      reflowListeners: new Set(),
    };
  }

  const formState = instanceCtx.forms[id];

  const reflow = useCallback(() => {
    for (const listener of formState.reflowListeners) {
      listener();
    }
  }, [formState]);

  const validateForm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget;

      const formData = new FormData(
        form,
        (event.nativeEvent as unknown as SubmitEvent).submitter
      );

      const parsed = v.safeParse(
        schema,
        Object.fromEntries(formData.entries())
      );
      if (!parsed.success) {
        event.preventDefault();
        formState.issues = v.flatten(parsed.issues);
        reflow();
        return;
      }

      formState.issues = undefined;
      reflow();
    },
    [formState, schema, reflow]
  );

  return (
    <formContext.Provider value={instanceCtx}>
      <Comp
        id={id}
        onBlur={useCallback<React.FocusEventHandler<HTMLFormElement>>(
          (event) => {
            if (validateOn === "blur" || validateOn.includes("blur")) {
              validateForm(event);
            }

            if (onBlur) {
              onBlur(event);
            }
          },
          [onBlur, validateForm, validateOn]
        )}
        onChange={useCallback<React.FormEventHandler<HTMLFormElement>>(
          (event) => {
            if (validateOn === "change" || validateOn.includes("change")) {
              validateForm(event);
            }

            if (onChange) {
              onChange(event);
            }
          },
          [onChange, validateForm, validateOn]
        )}
        onSubmit={useCallback<React.FormEventHandler<HTMLFormElement>>(
          (event) => {
            if (validateOn === "submit" || validateOn.includes("submit")) {
              validateForm(event);
            }

            if (onSubmit) {
              onSubmit(event);
            }
          },
          [onSubmit, validateForm, validateOn]
        )}
        {...props}
      />
    </formContext.Provider>
  );
}

export type ValidatedCheckboxProps = React.ComponentProps<typeof Checkbox> & {
  label: React.ReactNode;
};

export function ValidatedCheckbox({
  form: formId,
  id: _id,
  label,
  name,
  ...props
}: ValidatedCheckboxProps) {
  const __id = useId();
  const errorId = useId();

  const id = typeof _id === "string" ? _id : __id;

  const form = useFormState(formId);

  const errors = form.issues?.nested?.[name as keyof typeof form.issues.nested];

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          aria-labelledby={errorId}
          id={id}
          form={formId}
          name={name}
          {...props}
        />
        <label className="flex-1" htmlFor={id}>
          {label}
        </label>
      </div>
      {!!errors?.length && (
        <span
          id={errorId}
          className="text-destructive"
          data-testid="validated-error"
        >
          {errors.join(" ")}
        </span>
      )}
    </div>
  );
}

export type ValidatedInputProps = React.ComponentProps<typeof Input> & {
  label: React.ReactNode;
};

export function ValidatedInput({
  form: formId,
  id: _id,
  label,
  name,
  ...props
}: ValidatedInputProps) {
  const __id = useId();
  const errorId = useId();

  const id = typeof _id === "string" ? _id : __id;

  const form = useFormState(formId);

  const errors = form.issues?.nested?.[name as keyof typeof form.issues.nested];

  return (
    <div className="flex flex-col space-y-2">
      <label htmlFor={id}>{label}</label>
      <Input
        aria-labelledby={errorId}
        form={formId}
        id={id}
        name={name}
        {...props}
      />
      {!!errors?.length && (
        <span
          id={errorId}
          className="text-destructive"
          data-testid="validated-error"
        >
          {errors.join(" ")}
        </span>
      )}
    </div>
  );
}

export type ValidatedSelectProps = React.ComponentProps<typeof Select> & {
  label: React.ReactNode;
};

export function ValidatedSelect({
  form: formId,
  id: _id,
  label,
  name,
  ...props
}: ValidatedSelectProps) {
  const __id = useId();
  const errorId = useId();

  const id = typeof _id === "string" ? _id : __id;

  const form = useFormState(formId);

  const errors = form.issues?.nested?.[name as keyof typeof form.issues.nested];

  return (
    <div className="flex flex-col space-y-2">
      <label htmlFor={id}>{label}</label>
      <Select
        aria-labelledby={errorId}
        form={formId}
        id={id}
        name={name}
        {...props}
      />
      {!!errors?.length && (
        <span
          id={errorId}
          className="text-destructive"
          data-testid="validated-error"
        >
          {errors.join(" ")}
        </span>
      )}
    </div>
  );
}

export type ValidatedTextareaProps = React.ComponentProps<typeof Textarea> & {
  label: React.ReactNode;
};

export function ValidatedTextarea({
  form: formId,
  id: _id,
  label,
  name,
  ...props
}: ValidatedTextareaProps) {
  const __id = useId();
  const errorId = useId();

  const id = typeof _id === "string" ? _id : __id;

  const form = useFormState(formId);

  const errors = form.issues?.nested?.[name as keyof typeof form.issues.nested];

  return (
    <div className="flex flex-col space-y-2">
      <label htmlFor={id}>{label}</label>
      <Textarea
        aria-labelledby={errorId}
        form={formId}
        id={id}
        name={name}
        {...props}
      />
      {!!errors?.length && (
        <span
          id={errorId}
          className="text-destructive"
          data-testid="validated-error"
        >
          {errors.join(" ")}
        </span>
      )}
    </div>
  );
}
