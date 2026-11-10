/**
 * The WordPress password check against hashes PHP made the WordPress way (fixtures/wordpress-hashes.json:
 * made-up test passwords only), in every format WordPress 7.1.4 accepts.
 */
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/wordpress-hashes.json";
import { checkWordPressPassword, wordpressHashFormat } from "./wordpress-password";

const vectors = fixture.vectors;

describe("WordPress password hashes", () => {
  it("recognises each format", () => {
    const v = vectors[0];
    expect(wordpressHashFormat(v.wp)).toBe("wp-bcrypt");
    expect(wordpressHashFormat(v.phpass)).toBe("phpass");
    expect(wordpressHashFormat(v.bcrypt)).toBe("bcrypt");
    expect(wordpressHashFormat(v.md5)).toBe("md5");
    expect(wordpressHashFormat("$argon2id$v=19$m=65536,t=4,p=1$abc$def")).toBe("unsupported");
  });

  for (const v of vectors) {
    it(`accepts the right password and refuses a wrong one (${JSON.stringify(v.password.slice(0, 16))})`, async () => {
      for (const hash of [v.wpUntrimmed, v.phpass, v.bcrypt, v.md5]) {
        expect(await checkWordPressPassword(v.password, hash)).toBe(true);
        // Changed at the start: plain bcrypt only reads the first 72 bytes (PHP's too), which is why
        // WordPress 6.8 pre-hashes in its "$wp" format.
        expect(await checkWordPressPassword(`#${v.password}`, hash)).toBe(false);
      }
    });
  }

  it("checks the password as typed, as WordPress does (it trims only when it makes a hash)", async () => {
    const spaced = vectors.find((v) => v.password === " spaced ")!;
    expect(await checkWordPressPassword("spaced", spaced.wp)).toBe(true);
    expect(await checkWordPressPassword(" spaced ", spaced.wp)).toBe(false);
  });

  it("refuses empty hashes, passwords over 4096 characters and formats it doesn't know", async () => {
    expect(await checkWordPressPassword("anything", "")).toBe(false);
    expect(await checkWordPressPassword("x".repeat(4097), vectors[0].md5)).toBe(false);
    expect(await checkWordPressPassword("anything", "$argon2id$v=19$m=65536,t=4,p=1$abc$def")).toBe(false);
  });
});
