import { greet } from "./index.js";

describe("greet", () => {
  it("greets the user", () => {
    expect(greet("World")).toBe("Hello, World");
  });
});
