import { Container } from "../ui/primitives";
import { LockIcon } from "../ui/icons";

/** Shown at /admin until an admin password is configured on the server. */
export function AdminSetup() {
  return (
    <Container className="grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-xl rounded-3xl border bg-card p-8 shadow-[0_30px_60px_-40px_rgb(15_23_42/0.45)] sm:p-10">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <LockIcon size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Set an admin password to start importing</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The import page is protected by a password that is stored on the server, never in the code. Add the setting once:
        </p>
        <ol className="mt-6 space-y-5 text-sm leading-relaxed text-foreground/85">
          <li>
            <p className="font-semibold text-foreground">On Vercel</p>
            <p className="mt-1">
              Project → Settings → Environment Variables → add <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">ADMIN_PASSWORD</code>{" "}
              with a strong password, then redeploy.
            </p>
          </li>
          <li>
            <p className="font-semibold text-foreground">On a test machine</p>
            <p className="mt-1">
              Create a file <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">.env.local</code> in the app folder containing{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">ADMIN_PASSWORD=your-password</code>, then restart the app.
            </p>
          </li>
        </ol>
      </div>
    </Container>
  );
}
