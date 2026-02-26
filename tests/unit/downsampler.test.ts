import { downsample } from "@server/services/downsampler";
import { describe, expect, it } from "vitest";

// Helper: build a monotonically increasing series of n points.
function makeValues(n: number): [number, string][] {
	return Array.from({ length: n }, (_, i) => [i * 60, String(Math.sin(i / 10) * 100)]);
}

describe("downsample", () => {
	it("returns an empty array when given an empty input", () => {
		expect(downsample([], 300)).toEqual([]);
	});

	it("returns the original array when length is less than maxPoints", () => {
		const values = makeValues(10);
		const result = downsample(values, 300);
		expect(result).toEqual(values);
	});

	it("returns the original array when length equals maxPoints", () => {
		const values = makeValues(300);
		const result = downsample(values, 300);
		expect(result).toEqual(values);
	});

	it("returns at most maxPoints entries after downsampling", () => {
		const values = makeValues(1000);
		const result = downsample(values, 300);
		expect(result.length).toBeLessThanOrEqual(300);
	});

	it("preserves the first point", () => {
		const values = makeValues(500);
		const result = downsample(values, 100);
		expect(result[0]).toEqual(values[0]);
	});

	it("preserves the last point", () => {
		const values = makeValues(500);
		const result = downsample(values, 100);
		expect(result[result.length - 1]).toEqual(values[values.length - 1]);
	});

	it("returns only the first point when maxPoints is 1", () => {
		const values = makeValues(500);
		const result = downsample(values, 1);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(values[0]);
	});

	it("returns exactly first and last points when maxPoints is 2", () => {
		const values = makeValues(500);
		const result = downsample(values, 2);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual(values[0]);
		expect(result[1]).toEqual(values[values.length - 1]);
	});

	it("returns exactly maxPoints entries for a large series", () => {
		const values = makeValues(2000);
		const result = downsample(values, 300);
		// LTTB always produces exactly maxPoints for input larger than maxPoints.
		expect(result.length).toBe(300);
	});

	it("all returned timestamps are from the original series", () => {
		const values = makeValues(500);
		const originalTs = new Set(values.map(([t]) => t));
		const result = downsample(values, 100);
		for (const [t] of result) {
			expect(originalTs.has(t)).toBe(true);
		}
	});

	it("returned points are in chronological order", () => {
		const values = makeValues(500);
		const result = downsample(values, 100);
		for (let i = 1; i < result.length; i++) {
			expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
		}
	});
});
