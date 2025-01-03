export type GlobalLoaderProps = {
  loading: boolean;
};

export function GlobalLoader({ loading }: GlobalLoaderProps) {
  if (!loading) {
    return null;
  }

  return (
    <div className="z-40 h-1.5 w-screen overflow-hidden fixed top-0 left-0">
      <div className="animate-progress w-full h-full bg-primary origin-left-right" />
    </div>
  );
}
