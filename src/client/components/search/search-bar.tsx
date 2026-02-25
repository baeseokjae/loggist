import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "로그 검색..." }: SearchBarProps) {
	const [localValue, setLocalValue] = useState(value);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const newValue = e.target.value;
		setLocalValue(newValue);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			onChange(newValue);
		}, 500);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
			onChange(localValue);
		}
	}

	return (
		<div className="relative flex items-center">
			<Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
			<input
				type="text"
				value={localValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="h-10 w-full rounded-md border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			/>
		</div>
	);
}
