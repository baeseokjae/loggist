export interface ApiResponse<T> {
	data: T;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	limit: number;
	offset: number;
}
