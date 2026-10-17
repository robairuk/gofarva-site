import { describe, it, expect, beforeEach } from "vitest";
import { handleSubscribe, isValidEmail, normalizeEmail, hashIp } from "../src/index.js";

function memoryDb() {
  const subscribers = new Map();
  const rate = new Map();
  return {
    prepare(sql) {
      const self = {
        _binds: [],
        bind(...args) {
          self._binds = args;
          return self;
        },
        async first() {
          if (sql.includes("FROM rate_limits")) {
            const key = `${self._binds[0]}|${self._binds[1]}`;
            const hit = rate.get(key);
            return hit ? { hit_count: hit } : null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INTO rate_limits")) {
            const key = `${self._binds[0]}|${self._binds[1]}`;
            rate.set(key, (rate.get(key) || 0) + 1);
            return { success: true };
          }
          if (sql.includes("INTO subscribers")) {
            const [email, email_normalized, created_at, updated_at, consent_text_version, source] =
              self._binds;
            const prev = subscribers.get(email);
            subscribers.set(email, {
              email,
              email_normalized,
              created_at: prev ? prev.created_at : created_at,
              updated_at,
              consent: 1,
              consent_text_version,
              source,
            });
            return { success: true };
          }
          return { success: true };
        },
      };
      return self;
    },
    _subscribers: subscribers,
    _rate: rate,
  };
}

function env() {
  return {
    DB: memoryDb(),
    SALT: "test-salt",
    ALLOWED_ORIGINS: "https://gofarva.run,https://www.gofarva.run",
    CONSENT_TEXT_VERSION_DEFAULT: "launch-notify-v1",
  };
}

function req(body, headers = {}) {
  return new Request("https://gofarva.run/api/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://gofarva.run",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("helpers", () => {
  it("validates email", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("a@" + "x".repeat(250) + ".com")).toBe(false);
  });
  it("normalizes email", () => {
    expect(normalizeEmail("  Rob@Example.COM ")).toBe("rob@example.com");
  });
  it("hashes ip with salt", async () => {
    const a = await hashIp("1.2.3.4", "salt");
    const b = await hashIp("1.2.3.4", "salt");
    const c = await hashIp("1.2.3.4", "other");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});

describe("handleSubscribe", () => {
  let e;
  beforeEach(() => {
    e = env();
  });

  it("accepts a valid signup", async () => {
    const res = await handleSubscribe(
      req({ email: "Runner@Example.com", consent: true, website: "" }),
      e,
      { ip: "9.9.9.9", now: "2026-10-16T10:00:00Z" }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(e.DB._subscribers.get("runner@example.com").consent).toBe(1);
  });

  it("silently accepts honeypot fills", async () => {
    const res = await handleSubscribe(
      req({ email: "bot@example.com", consent: true, website: "http://spam" }),
      e,
      { ip: "9.9.9.9" }
    );
    expect(res.status).toBe(200);
    expect(e.DB._subscribers.size).toBe(0);
  });

  it("requires consent and valid email", async () => {
    let res = await handleSubscribe(req({ email: "bad", consent: true }), e, { ip: "1.1.1.1" });
    expect(res.status).toBe(400);
    res = await handleSubscribe(req({ email: "ok@example.com", consent: false }), e, {
      ip: "1.1.1.1",
    });
    expect(res.status).toBe(400);
  });

  it("rate limits after 5 per hour", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await handleSubscribe(
        req({ email: `u${i}@example.com`, consent: true }),
        e,
        { ip: "8.8.8.8", now: "2026-10-16T10:15:00Z" }
      );
      expect(res.status).toBe(200);
    }
    const blocked = await handleSubscribe(
      req({ email: "last@example.com", consent: true }),
      e,
      { ip: "8.8.8.8", now: "2026-10-16T10:30:00Z" }
    );
    expect(blocked.status).toBe(429);
  });

  it("rejects other origins", async () => {
    const res = await handleSubscribe(
      req({ email: "ok@example.com", consent: true }, { Origin: "https://evil.example" }),
      e,
      { ip: "1.1.1.1" }
    );
    expect(res.status).toBe(403);
  });

  it("upserts duplicates", async () => {
    await handleSubscribe(
      req({ email: "same@example.com", consent: true, source: "a" }),
      e,
      { ip: "2.2.2.2", now: "2026-10-16T10:00:00Z" }
    );
    await handleSubscribe(
      req({ email: "SAME@example.com", consent: true, source: "b" }),
      e,
      { ip: "3.3.3.3", now: "2026-10-16T11:00:00Z" }
    );
    expect(e.DB._subscribers.size).toBe(1);
    expect(e.DB._subscribers.get("same@example.com").source).toBe("b");
  });

  it("allows www origin", async () => {
    const res = await handleSubscribe(
      req({ email: "www@example.com", consent: true }, { Origin: "https://www.gofarva.run" }),
      e,
      { ip: "4.4.4.4" }
    );
    expect(res.status).toBe(200);
  });
});


