import { placeholderHome, site } from "@/content/site";

// Placeholder until the homepage is rebuilt in chunks A7 and A8.
export default function HomePage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-5 py-16"
    >
      <p className="text-lg font-extrabold tracking-tight">
        <span className="text-green">{site.nameParts.first}</span>{" "}
        <span className="text-orange">{site.nameParts.second}</span>
      </p>
      <p className="text-xs font-extrabold tracking-[0.14em] text-teal uppercase">
        {placeholderHome.eyebrow}
      </p>
      <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
        {placeholderHome.titleLead}
        <br />
        <em className="text-teal not-italic">
          {placeholderHome.titleEmphasis}
        </em>
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        {placeholderHome.body}
      </p>
    </main>
  );
}
