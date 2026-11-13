/**
 * Esqueleto mostrado NA HORA ao trocar de aba, enquanto o servidor monta a página.
 * É o que tira a sensação de "travou": o toque responde no mesmo frame.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-2 lg:col-span-12">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-7 w-56 rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2 lg:col-span-12">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-md" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-md lg:col-span-7" />
      <div className="flex flex-col gap-4 lg:col-span-5">
        <div className="skeleton h-32 rounded-md" />
        <div className="skeleton h-32 rounded-md" />
      </div>
    </div>
  );
}
