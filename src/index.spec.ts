import { greet } from "../src";

describe("greet", () => {
  it("greets the user", () => {
    expect(greet("World")).toBe("Hello, World");
  });
});
