import PhaseCard from './PhaseCard';

export default function RoadmapVisualization({ phases = [], expandedId, setExpandedId, onToggleItem }) {
  return (
    <div className="space-y-4">
      {phases.map((phase) => (
        <div key={phase.id} className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[rgba(139,92,246,0.35)] hidden md:block" />
          <div className="md:ml-8">
            <PhaseCard
              phase={phase}
              expanded={expandedId === phase.id}
              onToggleExpand={() => setExpandedId(expandedId === phase.id ? null : phase.id)}
              onToggleItem={onToggleItem}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
