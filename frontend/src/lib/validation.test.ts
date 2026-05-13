import { describe, expect, it } from "vitest";
import {
  normalizeCommaSeparatedList,
  validateEmailAddress,
  validateHTTPUrl,
  validateIntegerRange,
  validateMailboxLocalPart,
  validateOneTimeCode,
  validateRequiredText,
  validateSelection,
} from "./validation";

describe("validation helpers", () => {
  it("validates required text boundaries", () => {
    expect(validateRequiredText("Subject", "", { minLength: 2 })).toBe("Subject is required。");
    expect(validateRequiredText("Subject", "a", { minLength: 2 })).toBe("Subject must be at least 2  characters。");
    expect(validateRequiredText("Subject", "abcd", { maxLength: 3 })).toBe("Subject must be at most 3  characters。");
    expect(validateRequiredText("Subject", "TextSubject", { minLength: 2, maxLength: 20 })).toBeNull();
  });

  it("validates email and webhook urls", () => {
    expect(validateEmailAddress("bad")).toBe("Invalid email address.");
    expect(validateEmailAddress("user@example.com")).toBeNull();
    expect(validateHTTPUrl("ftp://example.com")).toBe("Callback URL must use http:// or https://.");
    expect(validateHTTPUrl("https://example.com/hook")).toBeNull();
  });

  it("normalizes comma separated event lists", () => {
    expect(normalizeCommaSeparatedList("message.received, mailbox.released, message.received, ")).toEqual([
      "message.received",
      "mailbox.released",
    ]);
  });

  it("validates mailbox local part and one time code", () => {
    expect(validateMailboxLocalPart("A")).toBe("Mailbox prefix must be 2-64 lowercase letters, numbers, dots, underscores, or hyphens, and start with a letter or number.");
    expect(validateMailboxLocalPart("ok-mailbox")).toBeNull();
    expect(validateOneTimeCode("12ab")).toBe("verification code must be a 6-digit number.");
    expect(validateOneTimeCode("123456")).toBeNull();
  });

  it("validates selections and integer ranges", () => {
    expect(validateSelection("Domain", "", ["1", "2"])).toBe("Please select Domain。");
    expect(validateSelection("Domain", "3", ["1", "2"])).toBe("Domain is invalid. Please select again.");
    expect(validateSelection("Domain", "1", ["1", "2"])).toBeNull();
    expect(validateIntegerRange("RefreshText", 10, { min: 15, max: 60 })).toBe("RefreshText must be between 15  and  60 。");
    expect(validateIntegerRange("RefreshText", 30, { min: 15, max: 60 })).toBeNull();
  });
});
