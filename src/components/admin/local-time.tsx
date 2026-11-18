"use client";

import { useEffect, useState } from "react";

const format = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** A timestamp in the viewer's time zone (rendered after mount, so server and browser HTML match). */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const date = new Date(iso);
    setText(Number.isNaN(date.getTime()) ? iso : format.format(date));
  }, [iso]);
  return (
    <time dateTime={iso} className={className}>
      {text ?? iso.slice(0, 10)}
    </time>
  );
}
