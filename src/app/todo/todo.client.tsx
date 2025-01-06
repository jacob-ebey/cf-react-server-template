"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useActionState, useCallback, useState, useTransition } from "react";
import * as v from "valibot";

import { Button } from "~/components/ui/button";
import { GlobalLoader } from "~/components/ui/global-loader";
import {
  Sidebar,
  SidebarContainer,
  SidebarMain,
} from "~/components/ui/sidebar";
import { ValidatedForm, ValidatedInput } from "~/components/ui/validated-form";
import { logoutAction } from "~/global-actions";
import { cn } from "~/lib/utils";

import { AddTodoSchema, CreateTodoListSchema } from "./todo.shared";
import { requestFormReset } from "react-dom";

export function Layout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean | undefined>(
    undefined
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <SidebarContainer className="flex-1 h-full w-full">
        <Sidebar
          collapsed={sidebarCollapsed}
          open={sidebarOpen}
          onClose={closeSidebar}
          className="z-30"
          style={{ viewTransitionName: "left-menu" }}
        >
          <header className="sticky top-0 bg-background p-4 md:px-6 border-b-2 border-border flex items-center md:hidden">
            <Button className="md:hidden" onPress={closeSidebar} size="icon">
              <span className="sr-only">Close sidebar</span>
              <PanelLeftClose />
            </Button>
          </header>
          {sidebar}
        </Sidebar>
        <SidebarMain className="flex flex-col overflow-hidden">
          <header
            className={cn(
              "z-20 sticky top-0 bg-background p-4 md:px-6 flex items-center border-b-2 border-border gap-4"
            )}
          >
            <Button
              className="md:hidden"
              onPress={() => setSidebarOpen((open) => !open)}
              size="icon"
            >
              <span className="sr-only">Toggle sidebar</span>
              {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <Button
              size="icon"
              className="hidden md:inline-flex"
              onPress={() => setSidebarCollapsed((open) => !open)}
            >
              <span className="sr-only">Toggle sidebar</span>
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>

            <div className="flex-1" />

            <form action={logoutAction}>
              <Button type="submit">Logout</Button>
            </form>
          </header>
          {children}
        </SidebarMain>
      </SidebarContainer>
    </div>
  );
}

export function TodoListItem({
  delete: _delete,
  id,
  title,
}: {
  delete: () => void | Promise<void>;
  id: string;
  title: string;
}) {
  const [deleted, deleteAction, isDeleting] = useActionState(async () => {
    await _delete();
    return true;
  }, false);

  if (deleted) return null;

  if (isDeleting) {
    return (
      <li>
        <GlobalLoader loading />
        <span className="sr-only">Deleting {title}</span>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between">
      <a href={`/todo/${id}`} className="a">
        {title}
      </a>
      <form action={deleteAction}>
        <Button type="submit" variant="destructive">
          Delete
        </Button>
      </form>
    </li>
  );
}

export function AddTodoForm({
  add,
  initialIssues,
}: {
  initialText?: string;
  initialIssues?: v.FlatErrors<any>;
  add: (formData: FormData) => Promise<void>;
}) {
  const [transitioning, startTransition] = useTransition();

  return (
    <ValidatedForm
      className="flex flex-col space-y-6"
      schema={AddTodoSchema}
      initialIssues={initialIssues}
      validateOn="submit"
      action={add}
      onSubmit={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();

        if (transitioning) return;

        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          await add(formData);
          startTransition(() => {
            requestFormReset(form);
          });
        });
      }}
    >
      <ValidatedInput
        className="w-full"
        type="text"
        name="text"
        label="What do you need to do?"
        placeholder="What do you need to do?"
      />

      <Button type="submit">Add Todo</Button>
    </ValidatedForm>
  );
}

export function CreateTodoListForm({
  create,
  initialIssues,
}: {
  initialTitle?: string;
  initialIssues?: v.FlatErrors<any>;
  create: (formData: FormData) => Promise<void>;
}) {
  const [transitioning, startTransition] = useTransition();

  return (
    <ValidatedForm
      className="flex flex-col space-y-6"
      schema={CreateTodoListSchema}
      initialIssues={initialIssues}
      validateOn="submit"
      action={create}
      onSubmit={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();

        if (transitioning) return;

        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          await create(formData);
          startTransition(() => {
            requestFormReset(form);
          });
        });
      }}
    >
      <ValidatedInput
        className="w-full"
        type="text"
        name="title"
        label="New list name"
        placeholder="Enter list name"
      />

      <Button type="submit">Create Todo List</Button>
    </ValidatedForm>
  );
}
