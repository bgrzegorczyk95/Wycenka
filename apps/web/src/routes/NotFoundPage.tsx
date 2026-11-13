import { Link } from 'react-router';
import { buttonClass } from '../components/buttonClass';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Nie ma takiej strony" />
      <div className="px-5 lg:px-0">
        <Link to="/oferty" className={buttonClass('secondary')}>
          Wróć do ofert
        </Link>
      </div>
    </>
  );
}
