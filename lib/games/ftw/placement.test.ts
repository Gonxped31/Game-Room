import { describe, expect, it } from "vitest";
import { handNotes, placeNote, rankOrder, removeNote, resultHeadline, tapHandNote, tapItem, type Placement } from "./placement";

const FULL: Placement = { a: 1, b: 2, c: 3, d: 4, e: 5 };

describe("handNotes", () => {
  it("lists the notes not on the sheet, in order", () => {
    expect(handNotes({})).toEqual([1, 2, 3, 4, 5]);
    expect(handNotes({ a: 4, c: 1 })).toEqual([2, 3, 5]);
    expect(handNotes(FULL)).toEqual([]);
  });
});

describe("placeNote", () => {
  it("places a hand note on an empty item", () => {
    expect(placeNote({}, 3, "a")).toEqual({ a: 3 });
  });
  it("sends a hand note's target's old note back to the hand", () => {
    const next = placeNote({ a: 1 }, 3, "a");
    expect(next).toEqual({ a: 3 });
    expect(handNotes(next)).toContain(1);
  });
  it("moves a placed note onto an empty item", () => {
    expect(placeNote({ a: 1, b: 2 }, 1, "c")).toEqual({ b: 2, c: 1 });
  });
  it("swaps two placed notes", () => {
    expect(placeNote(FULL, 1, "e")).toEqual({ a: 5, b: 2, c: 3, d: 4, e: 1 });
  });
  it("leaves a note dropped on its own item alone", () => {
    expect(placeNote(FULL, 2, "b")).toBe(FULL);
  });
  it("never mutates its input", () => {
    const before = { a: 1, b: 2 };
    placeNote(before, 1, "b");
    expect(before).toEqual({ a: 1, b: 2 });
  });
});

describe("removeNote", () => {
  it("returns an item's note to the hand", () => {
    expect(removeNote({ a: 1, b: 2 }, "a")).toEqual({ b: 2 });
  });
  it("is a no-op on an empty item", () => {
    const placement = { a: 1 };
    expect(removeNote(placement, "b")).toBe(placement);
  });
});

describe("tapHandNote", () => {
  it("picks a note, switches to another, and puts it down on a second tap", () => {
    expect(tapHandNote(null, 2)).toEqual({ n: 2, from: null });
    expect(tapHandNote({ n: 2, from: null }, 4)).toEqual({ n: 4, from: null });
    expect(tapHandNote({ n: 2, from: null }, 2)).toBeNull();
  });
});

describe("tapItem", () => {
  it("places the picked hand note", () => {
    expect(tapItem({}, { n: 1, from: null }, "a")).toEqual({ placement: { a: 1 }, pick: null });
  });
  it("does nothing on an empty item with nothing picked", () => {
    expect(tapItem({ a: 1 }, null, "b")).toEqual({ placement: { a: 1 }, pick: null });
  });
  it("returns a placed note to the hand while the hand still has notes", () => {
    expect(tapItem({ a: 1, b: 2 }, null, "a")).toEqual({ placement: { b: 2 }, pick: null });
  });
  it("picks a placed note up for a swap once the hand is empty", () => {
    expect(tapItem(FULL, null, "c")).toEqual({ placement: FULL, pick: { n: 3, from: "c" } });
  });
  it("swaps a lifted note with the next item tapped", () => {
    const { placement, pick } = tapItem(FULL, { n: 3, from: "c" }, "a");
    expect(placement).toEqual({ a: 3, b: 2, c: 1, d: 4, e: 5 });
    expect(pick).toBeNull();
  });
  it("cancels a swap when the note's own item is tapped again", () => {
    expect(tapItem(FULL, { n: 3, from: "c" }, "c")).toEqual({ placement: FULL, pick: null });
  });
});

describe("rankOrder", () => {
  it("orders item IDs by their note, 1 first", () => {
    expect(rankOrder({ a: 3, b: 1, c: 5, d: 2, e: 4 }, ["a", "b", "c", "d", "e"])).toEqual(["b", "d", "a", "e", "c"]);
  });
});

describe("resultHeadline", () => {
  it.each([
    [5, "Same page!", "All 5 in the same order."],
    [3, "Close!", "Same page on 3 of 5."],
    [2, "Same chapter.", "Same page on 2 of 5."],
    [1, "Different chapters.", "Same page on 1 of 5."],
    [0, "Different books.", "No matches this time."],
  ])("%i matches: %s", (matches, headline, line) => {
    expect(resultHeadline(matches)).toEqual({ headline, line });
  });
});
