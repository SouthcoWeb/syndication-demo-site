import { redirect } from "next/navigation";

/** The legacy website opens straight on the product listing (PLP). */
export default function HomePage() {
  redirect("/catalog");
}
