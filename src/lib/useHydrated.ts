"use client";

/**
 * False in the server HTML and until React has taken over the page, then true. Forms that are sent by
 * JavaScript (checkout, My Account) keep their submit buttons disabled until then: before that, a click
 * would make the browser post the form itself, to an address that can't take it.
 */
import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

export const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);
