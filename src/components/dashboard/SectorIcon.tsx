const ICON_PATHS: Record<string, string> = {
  "civic-dome": "M4 20h16M6 20V11a6 6 0 0 1 12 0v9M12 5v2",
  "government-building": "M4 20h16M5 20V9l7-4 7 4v11M8 20v-6M12 20v-6M16 20v-6",
  sprout: "M12 20V10M12 10C12 6 9 4 6 4c0 4 2 6 6 6ZM12 10c0-3 2-5 5-5 0 3.5-2 5-5 5Z",
  "medical-cross": "M12 5v14M5 12h14",
  "graduation-cap": "M3 9l9-4 9 4-9 4-9-4Zm4 2v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5",
  "joined-hands": "M8 13l3 3 5-5M4 8c2-2 5-2 7 0M20 8c-2-2-5-2-7 0",
  "wind-sun": "M12 8a4 4 0 1 0 0 8M3 12h2M19 12h2M4 7l2 2M18 15l2 2M4 17l2-2M18 9l2-2",
};

const DEFAULT_PATH = "M12 4v16M4 12h16";

export function SectorIcon({ iconKey, className = "h-5 w-5" }: { iconKey: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        d={ICON_PATHS[iconKey] ?? DEFAULT_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
