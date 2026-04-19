import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface AppBreadcrumbProps {
  items: BreadcrumbSegment[];
}

/**
 * Unified breadcrumb component.
 *
 * - Desktop (md+): full trail  Home › Section › … › Current Page
 * - Mobile  (<md): single back-link  ← Parent
 *
 * Uses CSS-only responsive to stay a server component.
 */
export default function AppBreadcrumb({ items }: AppBreadcrumbProps) {
  if (items.length === 0) return null;

  // The parent is the second-to-last item (for mobile back link)
  const parent = items.length >= 2 ? items[items.length - 2] : null;

  return (
    <>
      {/* ── Mobile: single back-link to parent ── */}
      {parent?.href && (
        <nav aria-label="breadcrumb" className="mb-4 md:hidden">
          <Link
            href={parent.href}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-3.5 rtl:rotate-180" />
            {parent.label}
          </Link>
        </nav>
      )}

      {/* ── Desktop: full breadcrumb trail ── */}
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <BreadcrumbItem key={item.href ?? item.label}>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href!} />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
                {!isLast && <BreadcrumbSeparator />}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
