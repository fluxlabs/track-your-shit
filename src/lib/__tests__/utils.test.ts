// Track Your Shit - Utility Functions Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect } from "vitest";
import {
  formatCost,
  formatRelativeTime,
  truncatePath,
  getErrorMessage,
  cn,
} from "../utils";

describe("formatCost", () => {
  it("formats positive amounts correctly", () => {
    expect(formatCost(1.2345)).toBe("$1.2345");
    expect(formatCost(10.5)).toBe("$10.50");
    expect(formatCost(100.99)).toBe("$100.99");
  });

  it("formats zero correctly", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("formats small amounts with proper precision", () => {
    expect(formatCost(0.001)).toBe("$0.001");
    expect(formatCost(0.0001)).toBe("$0.0001");
  });

  it("formats large amounts with thousands separator", () => {
    expect(formatCost(1000)).toBe("$1,000.00");
    expect(formatCost(10000.5)).toBe("$10,000.50");
    expect(formatCost(1234567.89)).toBe("$1,234,567.89");
  });

  it("formats negative amounts correctly", () => {
    expect(formatCost(-5.25)).toBe("-$5.25");
    expect(formatCost(-100)).toBe("-$100.00");
  });

  it("handles very small decimal amounts", () => {
    expect(formatCost(0.00001)).toBe("$0.00");
    expect(formatCost(0.000123)).toBe("$0.0001");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date();

  it('returns "just now" for times less than 60 seconds ago', () => {
    const fiveSecondsAgo = new Date(now.getTime() - 5 * 1000);
    expect(formatRelativeTime(fiveSecondsAgo.toISOString())).toBe("just now");

    const fiftyNineSecondsAgo = new Date(now.getTime() - 59 * 1000);
    expect(formatRelativeTime(fiftyNineSecondsAgo.toISOString())).toBe("just now");
  });

  it("returns minutes ago for times less than 60 minutes ago", () => {
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    expect(formatRelativeTime(oneMinuteAgo.toISOString())).toBe("1m ago");

    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinutesAgo.toISOString())).toBe("30m ago");

    const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60 * 1000);
    expect(formatRelativeTime(fiftyNineMinutesAgo.toISOString())).toBe("59m ago");
  });

  it("returns hours ago for times less than 24 hours ago", () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatRelativeTime(oneHourAgo.toISOString())).toBe("1h ago");

    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    expect(formatRelativeTime(twelveHoursAgo.toISOString())).toBe("12h ago");

    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(formatRelativeTime(twentyThreeHoursAgo.toISOString())).toBe("23h ago");
  });

  it("returns days ago for times less than 7 days ago", () => {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo.toISOString())).toBe("1d ago");

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe("3d ago");

    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(sixDaysAgo.toISOString())).toBe("6d ago");
  });

  it("returns formatted date for times 7+ days ago", () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(eightDaysAgo.toISOString());
    // Should be a formatted date like "Jan 28, 3:45 PM"
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("returns formatted date for very old dates", () => {
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(oneYearAgo.toISOString());
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} (AM|PM)$/);
  });
});

describe("truncatePath", () => {
  it("returns path unchanged if within max length", () => {
    const shortPath = "/users/test";
    expect(truncatePath(shortPath, 40)).toBe(shortPath);
    expect(truncatePath(shortPath)).toBe(shortPath);
  });

  it("returns path unchanged if exactly at max length", () => {
    const path = "/users/test/project";
    expect(truncatePath(path, path.length)).toBe(path);
  });

  it("truncates long paths with ellipsis in middle", () => {
    const longPath = "/users/test/very/long/path/to/some/project/directory";
    const result = truncatePath(longPath, 40);
    expect(result).toContain("...");
    expect(result.length).toBeLessThanOrEqual(40);
    // slice(0,2) on ["", "users", "test"...] gives ["", "users"] which joins to "/users"
    expect(result).toBe("/users/.../project/directory");
  });

  it("keeps first two and last two parts when possible", () => {
    const path = "/home/user/projects/control-tower/src/components";
    const result = truncatePath(path, 40);
    // slice(0,2) on ["", "home", "user"...] gives ["", "home"] which joins to "/home"
    expect(result).toBe("/home/.../src/components");
  });

  it("falls back to showing only last two parts if too long", () => {
    const path = "/very-long-directory-name/another-very-long-name/src/components";
    const result = truncatePath(path, 30);
    expect(result).toBe(".../src/components");
  });

  it("handles paths with only two parts", () => {
    const path = "/users/test";
    // split gives ["", "users", "test"] which has length 3, not <= 2
    // So it will try to truncate. Let's test with a longer maxLength
    expect(truncatePath(path, 20)).toBe(path);
  });

  it("handles paths with only one part", () => {
    const path = "/users";
    expect(truncatePath(path, 3)).toBe(path);
  });

  it("uses default max length of 40", () => {
    const longPath = "/users/test/very/long/path/to/some/project/directory";
    const result = truncatePath(longPath);
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it("handles empty path", () => {
    expect(truncatePath("")).toBe("");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error objects", () => {
    const error = new Error("Something went wrong");
    expect(getErrorMessage(error)).toBe("Something went wrong");
  });

  it("extracts message from Error subclasses", () => {
    const error = new TypeError("Invalid type");
    expect(getErrorMessage(error)).toBe("Invalid type");
  });

  it("returns string errors as-is", () => {
    expect(getErrorMessage("Simple error string")).toBe("Simple error string");
    expect(getErrorMessage("")).toBe("");
  });

  it("converts unknown types to strings", () => {
    expect(getErrorMessage(42)).toBe("42");
    expect(getErrorMessage(true)).toBe("true");
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("handles object errors from Tauri backend", () => {
    const tauriError = { message: "Backend error", code: 500 };
    const result = getErrorMessage(tauriError);
    // Should convert object to string representation using String()
    expect(result).toBe("[object Object]");
  });

  it("handles arrays", () => {
    const result = getErrorMessage([1, 2, 3]);
    expect(result).toBe("1,2,3");
  });

  it("handles complex objects", () => {
    const complexError = { nested: { error: "deep error" } };
    const result = getErrorMessage(complexError);
    expect(result).toContain("object");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", true && "bar")).toBe("foo bar");
  });

  it("handles undefined and null values", () => {
    expect(cn("foo", undefined, "bar", null)).toBe("foo bar");
  });

  it("merges Tailwind classes correctly", () => {
    // tailwind-merge should handle conflicting classes
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});
