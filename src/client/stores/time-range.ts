import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

export const RANGE_VALUES = ["1h", "6h", "24h", "7d", "30d"] as const;
export type RangeValue = (typeof RANGE_VALUES)[number];

export const RANGE_SECONDS: Record<RangeValue, number> = {
	"1h": 60 * 60,
	"6h": 6 * 60 * 60,
	"24h": 24 * 60 * 60,
	"7d": 7 * 24 * 60 * 60,
	"30d": 30 * 24 * 60 * 60,
};

export const RANGE_LABEL: Record<RangeValue, string> = {
	"1h": "1시간",
	"6h": "6시간",
	"24h": "오늘",
	"7d": "7일",
	"30d": "30일",
};

export const RANGE_STEP: Record<RangeValue, string> = {
	"1h": "60",
	"6h": "120",
	"24h": "300",
	"7d": "1800",
	"30d": "7200",
};

export function useTimeRange() {
	const [range, setQueryRange] = useQueryState(
		"range",
		parseAsStringLiteral(RANGE_VALUES).withDefault("24h"),
	);

	function setRange(value: RangeValue) {
		void setQueryRange(value);
	}

	const { start, end } = useMemo(() => {
		const now = Math.floor(Date.now() / 1000);
		return {
			start: String(now - RANGE_SECONDS[range]),
			end: String(now),
		};
	}, [range]);

	return {
		range,
		setRange,
		start,
		end,
		step: RANGE_STEP[range],
		label: RANGE_LABEL[range],
	};
}
