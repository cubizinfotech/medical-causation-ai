import { socketTarget } from "./socket";

describe("socketTarget", () => {
  it("connects to the API host when the API has its own address", () => {
    expect(socketTarget("ewi", "https://api.example.com")).toEqual({
      url: "https://api.example.com/ewi",
      path: "/socket.io",
    });
    expect(socketTarget("ewi", "http://localhost:3001/")).toEqual({
      url: "http://localhost:3001/ewi",
      path: "/socket.io",
    });
  });

  it("keeps the namespace when the API is served under a path", () => {
    expect(socketTarget("medical-analysis", "http://157.230.156.87/api")).toEqual({
      url: "http://157.230.156.87/medical-analysis",
      path: "/api/socket.io",
    });
    expect(socketTarget("ewi", "https://157.230.156.87/api")).toEqual({
      url: "https://157.230.156.87/ewi",
      path: "/api/socket.io",
    });
  });
});
