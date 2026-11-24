"use client";

import { useActionState, useEffect } from "react";
import { unlockDownloads, type UnlockState } from "@/app/download/actions";
import { Button } from "./ui/button";
import { LoaderIcon } from "./ui/icons";

/** Password form on the download page. Once unlocked it opens the requested file. */
export function DownloadGate({ product, doc }: { product: string; doc: number }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockDownloads, { error: null, next: null });

  useEffect(() => {
    // A full navigation, because the download link answers with a redirect to the file.
    if (state.next) window.location.assign(state.next);
  }, [state.next]);

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="doc" value={doc} />
      <label htmlFor="download-password" className="block text-sm font-medium text-foreground">
        Presenter password
      </label>
      <input
        id="download-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "download-error" : undefined}
        className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
      />
      {state.error && (
        <p id="download-error" role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.next && (
        <p role="status" className="mt-2 text-sm text-success">
          Unlocked. Your download is opening…
        </p>
      )}
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !!state.next}>
        {pending && <LoaderIcon size={18} className="animate-spin" />}
        Unlock and download
      </Button>
    </form>
  );
}
