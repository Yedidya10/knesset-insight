import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

/**
 * Generates the array of page numbers to display, with ellipsis gaps.
 * Always shows first, last, and a window around the current page.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (currentPage > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);

  return pages;
}

interface PaginationNavProps {
  currentPage: number;
  totalPages: number;
  /** Function that returns the href for a given page number */
  buildPageUrl: (page: number) => string;
  /** Translated "Previous" label */
  previousLabel?: string;
  /** Translated "Next" label */
  nextLabel?: string;
}

export default function PaginationNav({
  currentPage,
  totalPages,
  buildPageUrl,
  previousLabel,
  nextLabel,
}: PaginationNavProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious
              href={buildPageUrl(currentPage - 1)}
              text={previousLabel}
            />
          </PaginationItem>
        )}

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href={buildPageUrl(p)}
                isActive={p === currentPage}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext
              href={buildPageUrl(currentPage + 1)}
              text={nextLabel}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
