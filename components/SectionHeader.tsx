export default function SectionHeader({ title }: { title: string }) {
  return (
    <div className="water-banner w-full py-6 sm:py-8 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-xl sm:text-2xl font-bold drop-shadow-md">
          {title}
        </h1>
      </div>
    </div>
  );
}
