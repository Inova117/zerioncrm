import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-bold text-brand-200">404</p>
        <h1 className="mt-2 text-lg font-semibold text-surface-800">Página no encontrada</h1>
        <p className="mt-1 text-sm text-surface-500">
          La página que buscas no existe o fue movida.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
