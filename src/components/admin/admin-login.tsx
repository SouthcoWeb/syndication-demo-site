"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions";
import { Button } from "../ui/button";
import { LoaderIcon, LockIcon } from "../ui/icons";
import { Container } from "../ui/primitives";

export function AdminLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <Container className="grid min-h-[70vh] place-items-center py-16">
      <form action={action} className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-[0_30px_60px_-40px_rgb(15_23_42/0.45)]">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <LockIcon size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Catalog admin</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Sign in to import products from your inRiver Excel export.</p>
        <label htmlFor="admin-password" className="mt-6 block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "admin-login-error" : undefined}
          className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        {state.error && (
          <p id="admin-login-error" role="alert" className="mt-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending}>
          {pending && <LoaderIcon size={18} className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </Container>
  );
}
