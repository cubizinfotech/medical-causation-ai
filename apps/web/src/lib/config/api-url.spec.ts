import { resolveApiBaseUrl } from "./api-url";

describe("resolveApiBaseUrl", () => {
  const original = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = original;
  });

  it("follows the public page host when the build inlined localhost", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    expect(resolveApiBaseUrl("157.230.156.87", "http:")).toBe(
      "http://157.230.156.87:3001",
    );
  });

  it("follows localhost when the configured API host is public", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://157.230.156.87:3001";
    expect(resolveApiBaseUrl("localhost", "http:")).toBe(
      "http://localhost:3001",
    );
  });

  it("keeps an explicit API host that already matches the page", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    expect(resolveApiBaseUrl("app.example.com", "https:")).toBe(
      "https://api.example.com",
    );
  });
});
