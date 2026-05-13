// Lives outside the "use server" boundary so we can co-export the type
// and the constant array. A "use server" module is allowed only async
// function exports — keep this file plain so both server and client
// code can import the palette.
export type Emoji = "thumbs_up" | "heart" | "rocket" | "party";
export const EMOJIS: Emoji[] = ["thumbs_up", "heart", "rocket", "party"];
