/**
 * Satisfies the guardrail that any list which cannot show all seven
 * sectors equally must explain its sorting/filtering method — shown
 * whenever a browse page has active filters that could break equal
 * sector representation.
 */
export function FilterEqualityNote() {
  return (
    <p className="text-xs text-slate-gray">
      Unfiltered, this list includes all seven sectors equally. Applying filters may show
      more results from some sectors than others.
    </p>
  );
}
