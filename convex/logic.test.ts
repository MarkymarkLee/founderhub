import { expect, test } from "vite-plus/test";
import { parseJsonAnswer } from "./agents";
import { capKey, quoteAppearsIn, scoreOf, stripIds } from "./lib";
import { intervieweeText } from "./meetings";
import { legalCheck } from "./tools";

test("score is a sigmoid of weighted, signed confidence", () => {
  expect(scoreOf([])).toBe(50);
  expect(scoreOf([{ stance: "supports", confidence: 1, weight: 3 }])).toBe(95);
  expect(scoreOf([{ stance: "disproves", confidence: 1, weight: 3 }])).toBe(5);
  // an interview outweighs a Reddit comment on the other side
  expect(
    scoreOf([
      { stance: "supports", confidence: 1, weight: 1 },
      { stance: "disproves", confidence: 1, weight: 3 },
    ]),
  ).toBeLessThan(50);
});

test("quotes must appear in the source, ignoring case, spacing and quote marks", () => {
  const text = "He said: “Students   don't pay for tools.” Then left.";
  expect(quoteAppearsIn("students don’t pay for tools", text)).toBe(true);
  expect(quoteAppearsIn("students will pay for tools", text)).toBe(false);
  expect(quoteAppearsIn("pay", text)).toBe(false); // too short to mean anything
});

test("legal guardrail refuses login-walled, paywalled and account pages", () => {
  expect(legalCheck("https://www.reddit.com/r/startups/comments/abc")).toBeNull();
  expect(legalCheck("https://www.linkedin.com/in/someone")).toMatch(/login-walled/);
  expect(legalCheck("https://blog.medium.com/x")).toMatch(/paywalled/);
  expect(legalCheck("https://example.com/account/settings")).toMatch(/Login/);
  expect(legalCheck("ftp://example.com/file")).toMatch(/public web/);
  expect(legalCheck("https://user:pw@example.com/")).toMatch(/credentials/);
});

test("touches count against the right daily cap", () => {
  expect(capKey("email", "send")).toBe("coldEmail");
  expect(capKey("email", "follow-up")).toBe("followUp");
  expect(capKey("linkedin", "connection")).toBe("linkedinConnection");
  expect(capKey("linkedin", "dm")).toBe("linkedinDm");
  expect(capKey("email", "thank-you")).toBeNull();
  expect(capKey("email", "reply")).toBeNull();
});

test("the founder's own lines never count as interview evidence", () => {
  const t =
    "Founder: Would you pay $20?\nRosa: Twenty is a lot.\n[00:12] Me: Why?\nRosa: Clubs pay.";
  expect(intervieweeText(t)).toBe("Rosa: Twenty is a lot.\nRosa: Clubs pay.");
});

test("Creao answers are parsed even when wrapped in prose or a code fence", () => {
  expect(parseJsonAnswer('Here you go:\n```json\n{"a": {"b": 1}}\n```')).toEqual({ a: { b: 1 } });
  expect(() => parseJsonAnswer("no json here")).toThrow();
});

test("raw ids are stripped from agent prose", () => {
  expect(stripIds("Only one quote (kd753xzynhcqarvzmnqn8g4z3s8gwkxm) names a price.")).toBe(
    "Only one quote names a price.",
  );
});
