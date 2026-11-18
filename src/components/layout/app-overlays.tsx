"use client";

import { Toaster } from "../ui/toaster";
import { CartDrawer } from "./cart-drawer";
import { CompareTray } from "./compare-tray";
import { SearchCommand } from "./search-command";

/** Global overlays mounted once in the root layout. The cart drawer only exists when products have prices. */
export function AppOverlays({ showCart = true }: { showCart?: boolean }) {
  return (
    <>
      <SearchCommand />
      {showCart && <CartDrawer />}
      <CompareTray />
      <Toaster />
    </>
  );
}
