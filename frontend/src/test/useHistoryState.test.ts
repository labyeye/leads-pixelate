import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHistoryState } from "@/hooks/useHistoryState";

describe("useHistoryState (undo / redo)", () => {
  const run = <T,>(initial: T) => renderHook(() => useHistoryState<T>(initial));

  it("undoes and redoes steps, and a new edit clears redo", () => {
    const { result } = run(0);
    act(() => result.current.set(1));
    act(() => result.current.set(2));
    expect(result.current.state).toBe(2);
    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
    act(() => result.current.redo());
    expect(result.current.state).toBe(2);
    act(() => result.current.undo());
    act(() => result.current.set(9));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
  });

  it("merges rapid same-group edits into one undo step", () => {
    const { result } = run(0);
    act(() => result.current.set(1, "drag"));
    act(() => result.current.set(2, "drag"));
    act(() => result.current.set(3, "drag"));
    act(() => result.current.undo());
    expect(result.current.state).toBe(0); // the whole drag was one step
    expect(result.current.canUndo).toBe(false);
  });
});
