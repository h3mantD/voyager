import { describe, it, expect } from "vitest";
import { sanitizeUrl, isSensitiveElement, mayContainSensitiveContent } from "../privacy";

describe("sanitizeUrl", () => {
  it("leaves clean URLs untouched", () => {
    expect(sanitizeUrl("https://app.com/dashboard")).toBe(
      "https://app.com/dashboard",
    );
  });

  it("leaves non-sensitive query params intact", () => {
    expect(sanitizeUrl("https://app.com/search?q=hello&page=2")).toBe(
      "https://app.com/search?q=hello&page=2",
    );
  });

  it("redacts token param", () => {
    const url = "https://app.com/callback?token=abc123&state=xyz";
    const result = sanitizeUrl(url);
    expect(result).toContain("token=%5BREDACTED%5D");
    expect(result).not.toContain("abc123");
    expect(result).toContain("state=xyz"); // state is not sensitive
  });

  it("redacts api_key param", () => {
    const result = sanitizeUrl("https://api.com/v1?api_key=sk-12345");
    expect(result).not.toContain("sk-12345");
    expect(result).toContain("api_key=%5BREDACTED%5D");
  });

  it("redacts access_token param", () => {
    const result = sanitizeUrl("https://app.com/auth?access_token=eyJ123");
    expect(result).not.toContain("eyJ123");
  });

  it("redacts code param (OAuth)", () => {
    const result = sanitizeUrl("https://app.com/callback?code=abc&scope=read");
    expect(result).not.toContain("code=abc");
    expect(result).toContain("scope=read");
  });

  it("redacts password param", () => {
    const result = sanitizeUrl("https://app.com/login?password=secret123");
    expect(result).not.toContain("secret123");
  });

  it("redacts params with token in the name", () => {
    const result = sanitizeUrl("https://app.com/verify?resetToken=xyz123");
    expect(result).not.toContain("xyz123");
  });

  it("redacts hash fragment tokens (OAuth implicit flow)", () => {
    const result = sanitizeUrl(
      "https://app.com/callback#access_token=abc123&scope=read",
    );
    expect(result).not.toContain("abc123");
    expect(result).toContain("scope=read");
  });

  it("handles malformed URLs gracefully", () => {
    expect(sanitizeUrl("not-a-url")).toBe("not-a-url");
    expect(sanitizeUrl("")).toBe("");
  });

  it("handles URLs with no query string", () => {
    expect(sanitizeUrl("https://app.com/path")).toBe(
      "https://app.com/path",
    );
  });
});

describe("isSensitiveElement", () => {
  it("detects password inputs", () => {
    const el = document.createElement("input");
    el.type = "password";
    expect(isSensitiveElement(el)).toBe(true);
  });

  it("detects inputs with secret-related names", () => {
    const el = document.createElement("input");
    el.type = "text";
    el.name = "api_key";
    expect(isSensitiveElement(el)).toBe(true);
  });

  it("detects inputs with password autocomplete", () => {
    const el = document.createElement("input");
    el.type = "text";
    el.setAttribute("autocomplete", "current-password");
    expect(isSensitiveElement(el)).toBe(true);
  });

  it("returns false for regular text inputs", () => {
    const el = document.createElement("input");
    el.type = "text";
    el.name = "username";
    expect(isSensitiveElement(el)).toBe(false);
  });

  it("returns false for non-input elements", () => {
    const el = document.createElement("div");
    expect(isSensitiveElement(el)).toBe(false);
  });

  it("detects credit card related inputs", () => {
    const el = document.createElement("input");
    el.type = "text";
    el.setAttribute("autocomplete", "cc-number");
    expect(isSensitiveElement(el)).toBe(true);
  });
});

describe("mayContainSensitiveContent", () => {
  it("detects 'api key' in element text", () => {
    const el = document.createElement("div");
    el.textContent = "Your API key is: sk-abc123456789";
    expect(mayContainSensitiveContent(el)).toBe(true);
  });

  it("detects 'private key' in element text", () => {
    const el = document.createElement("div");
    el.textContent = "Download your private key before closing";
    expect(mayContainSensitiveContent(el)).toBe(true);
  });

  it("detects 'recovery code' in element text", () => {
    const el = document.createElement("div");
    el.textContent = "Save your recovery codes in a safe place";
    expect(mayContainSensitiveContent(el)).toBe(true);
  });

  it("returns false for normal content", () => {
    const el = document.createElement("div");
    el.textContent = "Welcome to the dashboard. Click to continue.";
    expect(mayContainSensitiveContent(el)).toBe(false);
  });

  it("returns false for very short text", () => {
    const el = document.createElement("div");
    el.textContent = "OK";
    expect(mayContainSensitiveContent(el)).toBe(false);
  });

  it("returns false for empty elements", () => {
    const el = document.createElement("div");
    expect(mayContainSensitiveContent(el)).toBe(false);
  });
});
