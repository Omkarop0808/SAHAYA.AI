/** Loading / empty / error blocks for Study World screens */

export function LoadingSkeleton({ lines = 4, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      <div className="h-10 bg-[#E8E8E8] rounded-xl w-3/4" />
      {[...Array(lines)].map((_, i) => (
        <div key={i} className="h-4 bg-[#E8E8E8] rounded w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-[#CCCCCC] rounded-[20px] bg-white">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="font-display font-bold text-lg text-[#0D0D0D]">{title}</p>
      {hint && <p className="text-sm text-[#555555] mt-2 max-w-md">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="border-2 border-red-200 bg-red-50 rounded-[16px] px-5 py-4 text-red-800">
      <p className="font-semibold text-sm mb-2">Something went wrong</p>
      <p className="text-sm mb-3">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold bg-[#0D0D0D] text-[#FFFF66] border-none px-4 py-2 rounded-lg cursor-pointer"
        >
          Try again
        </button>
      )}
    </div>
  );
}
