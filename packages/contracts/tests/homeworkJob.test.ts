import { IllegalTransitionError, PHASES, PHASE_TRANSITIONS, queueKeyOf, setRunState, transitionPhase, type Phase } from "../src/homeworkJob";

const now = () => "2026-01-01T00:00:00.000Z";

describe("phase transitions", () => {
  it("allows every transition declared in the table and derives queueKey", () => {
    for (const from of PHASES) {
      for (const to of PHASE_TRANSITIONS[from]) {
        const result = transitionPhase({ phase: from, runState: "done" }, to, "queued", now);
        expect(result).toEqual({ phase: to, runState: "queued", queueKey: `${to}:queued`, updatedAt: now() });
      }
    }
  });

  it("rejects every transition not declared in the table", () => {
    for (const from of PHASES) {
      const allowed = new Set(PHASE_TRANSITIONS[from]);
      for (const to of PHASES.filter((phase) => !allowed.has(phase))) {
        expect(() => transitionPhase({ phase: from, runState: "done" }, to as Phase, "queued", now)).toThrow(IllegalTransitionError);
      }
    }
  });

  it("supports resuming a failed job back into scripting", () => {
    const result = transitionPhase({ phase: "failed", runState: "error" }, "scripting", "queued", now);
    expect(result.queueKey).toBe("scripting:queued");
  });
});

describe("run state transitions", () => {
  it("walks queued -> running -> done", () => {
    expect(setRunState({ phase: "analyzing", runState: "queued" }, "running", now).queueKey).toBe("analyzing:running");
    expect(setRunState({ phase: "analyzing", runState: "running" }, "done", now).queueKey).toBe("analyzing:done");
  });

  it("allows retry via error -> queued and nothing else from terminal states", () => {
    expect(setRunState({ phase: "analyzing", runState: "error" }, "queued", now).queueKey).toBe("analyzing:queued");
    expect(() => setRunState({ phase: "analyzing", runState: "done" }, "running", now)).toThrow(IllegalTransitionError);
    expect(() => setRunState({ phase: "analyzing", runState: "queued" }, "done", now)).toThrow(IllegalTransitionError);
  });
});

describe("queueKey derivation", () => {
  it("is always phase:runState", () => {
    expect(queueKeyOf("scripting", "queued")).toBe("scripting:queued");
  });
});
