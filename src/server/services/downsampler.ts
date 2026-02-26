/**
 * LTTB (Largest-Triangle-Three-Buckets) downsampling for time-series data.
 *
 * The `lttb` package (v0.0.1) installed in this project is an empty stub with
 * no implementation, so LTTB is implemented here directly.
 *
 * Algorithm reference: Sveinn Steinarsson, "Downsampling Time Series for Visual
 * Representation" (2013), https://skemman.is/handle/1946/15343
 */

/**
 * Downsample a Prometheus values array using the LTTB algorithm.
 *
 * @param values   Array of [unixTimestampSeconds, valueString] tuples as
 *                 returned by a Prometheus range query.
 * @param maxPoints Maximum number of data points to retain.
 * @returns        A new array with at most `maxPoints` entries that preserves
 *                 the visual shape of the original series.
 */
export function downsample(values: [number, string][], maxPoints: number): [number, string][] {
	// Nothing to do for empty input or if we already have fewer points.
	if (values.length === 0) return [];
	if (maxPoints <= 0 || values.length <= maxPoints) return values;

	// LTTB requires at least 3 points (first bucket, middle buckets, last bucket).
	// With maxPoints === 1 or 2 we return the boundary points directly.
	if (maxPoints === 1) return [values[0]];
	if (maxPoints === 2) return [values[0], values[values.length - 1]];

	const sampled: [number, string][] = [];

	// Always keep the first point.
	sampled.push(values[0]);

	// The number of inner buckets (excluding first and last fixed points).
	const bucketCount = maxPoints - 2;
	const dataLength = values.length - 2; // exclude first and last

	let prevSelected = 0; // index of the last selected point

	for (let i = 0; i < bucketCount; i++) {
		// Determine the range of the current bucket.
		const bucketStart = Math.floor((i * dataLength) / bucketCount) + 1;
		const bucketEnd = Math.floor(((i + 1) * dataLength) / bucketCount) + 1;

		// Determine the range of the next bucket (used for the average point).
		const nextBucketStart = bucketEnd;
		const nextBucketEnd =
			i + 1 < bucketCount
				? Math.floor(((i + 2) * dataLength) / bucketCount) + 1
				: values.length - 1;

		// Compute the average (x, y) of the next bucket as the reference point.
		let avgX = 0;
		let avgY = 0;
		const nextBucketSize = nextBucketEnd - nextBucketStart;
		for (let j = nextBucketStart; j < nextBucketEnd; j++) {
			avgX += values[j][0];
			avgY += Number(values[j][1]);
		}
		avgX /= nextBucketSize;
		avgY /= nextBucketSize;

		// Among all points in the current bucket, select the one that forms the
		// largest triangle with the previously selected point and the next-bucket
		// average.
		const [prevX, prevY] = [values[prevSelected][0], Number(values[prevSelected][1])];

		let maxArea = -1;
		let selectedIndex = bucketStart;

		for (let j = bucketStart; j < bucketEnd; j++) {
			const x = values[j][0];
			const y = Number(values[j][1]);

			// Triangle area (× 2, sign ignored) via cross product.
			const area = Math.abs((prevX - avgX) * (y - prevY) - (prevX - x) * (avgY - prevY));

			if (area > maxArea) {
				maxArea = area;
				selectedIndex = j;
			}
		}

		sampled.push(values[selectedIndex]);
		prevSelected = selectedIndex;
	}

	// Always keep the last point.
	sampled.push(values[values.length - 1]);

	return sampled;
}
