/**
 * User-facing demo-data disclosure. meta.warning in seed/demo-data.json is
 * instructional wording aimed at developers ("Display a Demo data notice
 * wherever these records are rendered") rather than end-user copy, so this
 * banner uses its own visitor-facing sentence instead of rendering that
 * field directly.
 */
export function DemoDataBanner() {
  return (
    <div className="border-b border-border-subtle bg-light-gray px-4 py-2 text-center text-sm text-ink">
      <strong className="font-semibold">Demo data:</strong> Every company, signal, and
      source shown here is fictional and for demonstration only. This dashboard is not
      live monitoring.
    </div>
  );
}
