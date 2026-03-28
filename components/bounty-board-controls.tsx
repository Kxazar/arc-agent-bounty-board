import type { BoardScopeFilter, BoardSortOption, BoardStatusFilter } from "@/components/bounty-board-types";

interface BountyBoardControlsProps {
  actionNeededCount: number;
  hasActiveFilters: boolean;
  onReset: () => void;
  onScopeFilterChange: (value: BoardScopeFilter) => void;
  onSearchChange: (value: string) => void;
  onSortByChange: (value: BoardSortOption) => void;
  onStatusFilterChange: (value: BoardStatusFilter) => void;
  openCount: number;
  scopeFilter: BoardScopeFilter;
  searchValue: string;
  sortBy: BoardSortOption;
  statusFilter: BoardStatusFilter;
  totalCount: number;
  visibleCount: number;
}

export function BountyBoardControls({
  actionNeededCount,
  hasActiveFilters,
  onReset,
  onScopeFilterChange,
  onSearchChange,
  onSortByChange,
  onStatusFilterChange,
  openCount,
  scopeFilter,
  searchValue,
  sortBy,
  statusFilter,
  totalCount,
  visibleCount
}: BountyBoardControlsProps) {
  return (
    <div className="board-controls">
      <div className="board-metrics">
        <div className="metric-pill">
          <span>Visible</span>
          <strong>
            {visibleCount}/{totalCount}
          </strong>
        </div>
        <div className="metric-pill">
          <span>Open now</span>
          <strong>{openCount}</strong>
        </div>
        <div className="metric-pill">
          <span>Action needed</span>
          <strong>{actionNeededCount}</strong>
        </div>
      </div>

      <div className="board-controls-grid">
        <label className="field">
          <span>Search board</span>
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, summary, contact, bounty #, or agent ID"
            type="search"
            value={searchValue}
          />
        </label>

        <label className="field">
          <span>Status</span>
          <select onChange={(event) => onStatusFilterChange(event.target.value as BoardStatusFilter)} value={statusFilter}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="submitted">Submitted</option>
            <option value="revision_requested">Changes requested</option>
            <option value="approved">Approved</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="field">
          <span>View</span>
          <select onChange={(event) => onScopeFilterChange(event.target.value as BoardScopeFilter)} value={scopeFilter}>
            <option value="all">All bounties</option>
            <option value="open">Open to claim</option>
            <option value="created">Created by me</option>
            <option value="claimed">Claimed by me</option>
            <option value="action">Needs my action</option>
          </select>
        </label>

        <label className="field">
          <span>Sort</span>
          <select onChange={(event) => onSortByChange(event.target.value as BoardSortOption)} value={sortBy}>
            <option value="newest">Newest first</option>
            <option value="reward">Highest reward</option>
            <option value="deadline">Most urgent window</option>
          </select>
        </label>
      </div>

      {hasActiveFilters ? (
        <div className="board-controls-footer">
          <button className="button button-ghost" onClick={onReset} type="button">
            Reset board view
          </button>
        </div>
      ) : null}
    </div>
  );
}
