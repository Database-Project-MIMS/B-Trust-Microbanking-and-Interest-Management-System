"use client";

import type { FormEvent } from "react";

export interface RecordFilters {
  q: string;
  status: string;
  selection: string;
}

interface RecordListFiltersProps {
  resource: string;
  searchLabel: string;
  selectionLabel: string;
  options: { value: string; label: string }[];
  statuses: string[];
  value: RecordFilters;
  onChange: (value: RecordFilters) => void;
  onSearch: () => void;
  onClear: () => void;
}

/** Applies draft filters explicitly using native, labeled controls. */
export function RecordListFilters({ resource, searchLabel, selectionLabel, options, statuses, value, onChange, onSearch, onClear }: RecordListFiltersProps) {
  const id = resource.replaceAll(" ", "-");
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSearch();
  }
  return <form aria-label={`Filter ${resource}`} className="card form-grid" onSubmit={submit}>
    <div className="two-col">
      <label className="field" htmlFor={`${id}-search`}>{searchLabel}
        <input className="input" id={`${id}-search`} maxLength={150} onChange={event => onChange({ ...value, q: event.target.value })} value={value.q} type="search" />
      </label>
      <label className="field" htmlFor={`${id}-status-filter`}>Status
        <select className="input" id={`${id}-status-filter`} onChange={event => onChange({ ...value, status: event.target.value })} value={value.status}>
          <option value="ALL">All statuses</option>
          {statuses.map(status => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={`${id}-selection-filter`}>{selectionLabel}
        <select className="input" id={`${id}-selection-filter`} onChange={event => onChange({ ...value, selection: event.target.value })} value={value.selection}>
          <option value="">All {selectionLabel === "Branch" ? "branches" : `${selectionLabel.toLowerCase()}s`}</option>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-3">
      <button className="btn btn-primary" type="submit">Search {resource}</button>
      <button className="btn btn-secondary" onClick={onClear} type="button">Clear filters</button>
    </div>
  </form>;
}
