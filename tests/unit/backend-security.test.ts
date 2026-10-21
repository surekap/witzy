import * as rooms from "@/convex/rooms";
import * as practice from "@/convex/practice";
import * as questionBank from "@/convex/questionBank";
import * as snapshot from "@/convex/snapshot";
import * as questionFlags from "@/convex/questionFlags";
import * as security from "@/convex/security";

it("does not expose storage or maintenance functions to unauthenticated Convex clients", () => {
  for (const backendModule of [rooms, practice, questionBank, snapshot, questionFlags, security]) {
    for (const [name, fn] of Object.entries(backendModule)) {
      if (backendModule === rooms && name === "watchRevision") continue;
      expect(fn).toHaveProperty("isInternal", true);
    }
  }
});
