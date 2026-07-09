import { Card } from "@/components/ui/Card";

const PRINCIPLES = [
  { label: "Transparent", description: "Sources and reasoning are visible, not hidden." },
  { label: "Investigative", description: "We look past hype to what public evidence shows." },
  { label: "Human-in-the-loop", description: "A person reviews before anything is marked verified." },
  { label: "Public-interest", description: "Built for the public good, not for ranking or hype." },
];

export function PlatformPrinciples() {
  return (
    <Card as="section" aria-labelledby="platform-principles-heading">
      <h2 id="platform-principles-heading" className="text-lg font-semibold text-indigo-navy">
        Platform principles
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-4">
        {PRINCIPLES.map(({ label, description }) => (
          <li key={label} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-deep-teal">{label}</span>
            <span className="text-xs text-slate-gray">{description}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
