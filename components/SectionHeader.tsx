export default function SectionHeader({ title }: { title: string }) {
  return (
    <header className="w-full water-banner text-white py-4 px-6 md:px-12 shadow-md">
      <div className="max-w-6xl mx-auto flex items-center">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
          {title}
        </h1>
      </div>
    </header>
  );
}
