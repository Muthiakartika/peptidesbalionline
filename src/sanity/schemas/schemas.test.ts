/**
 * The Studio refuses to start when a schema has an error (an unknown type, a duplicate name, a bad
 * block definition…). This runs Sanity's own schema check, so that shows up here instead of on the
 * editor's screen.
 */
import { groupProblems, validateSchema } from "@sanity/schema/_internal";
import { describe, expect, it } from "vitest";

import { schemaTypes } from "./index";

describe("Sanity schemas", () => {
  it("have no errors", () => {
    const problems = groupProblems(validateSchema(schemaTypes).getTypes())
      .flatMap((group) => group.problems.filter((problem) => problem.severity === "error").map((problem) => `${group.path.map((p) => p.name ?? p.kind).join(" › ")}: ${problem.message}`));
    expect(problems).toEqual([]);
  });
});
