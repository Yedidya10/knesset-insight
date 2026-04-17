'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { appConfig } from '../../../app.config';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const sizeMap = {
  sm: { container: 'h-7 w-7', text: 'text-xs', px: 28 },
  md: { container: 'h-14 w-14', text: 'text-sm', px: 56 },
  lg: { container: 'h-20 w-20', text: 'text-lg', px: 80 },
  xl: { container: 'h-28 w-28', text: 'text-2xl', px: 112 },
} as const;

interface MemberAvatarProps {
  member: {
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    imageSource?: string | null;
  };
  size?: keyof typeof sizeMap;
  className?: string;
  ring?: string;
  priority?: boolean;
}

export default function MemberAvatar({
  member,
  size = 'md',
  className,
  ring,
  priority,
}: MemberAvatarProps) {
  const t = useTranslations('images');
  const [imgError, setImgError] = useState(false);

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;
  const s = sizeMap[size];
  const isPlaceholder = member.imageUrl?.includes('placeholder');
  const showImage = member.imageUrl && !isPlaceholder && !imgError;

  // Local images (downloaded to public/images/mks/) use Next.js optimization.
  // External Wikimedia images (legacy/fallback) skip optimization to avoid 429s.
  const isLocal = member.imageUrl?.startsWith('/images/');
  const isWikimedia =
    !isLocal &&
    (member.imageUrl?.includes('wikimedia.org') ||
      member.imageUrl?.includes('wikipedia.org'));

  const attributionKey = member.imageSource as
    | 'oknesset'
    | 'wikidata'
    | 'knessetOfficial'
    | 'manual'
    | null;
  const tooltip =
    attributionKey && attributionKey in appConfig.images.sources
      ? t(`attribution.${attributionKey}`)
      : undefined;

  const avatarNode = (
    <div
      className={cn(
        'bg-primary/10 relative shrink-0 overflow-hidden rounded-full',
        s.container,
        ring,
        className,
      )}
    >
      {showImage ? (
        <Image
          src={member.imageUrl!}
          alt={`${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()}
          width={s.px}
          height={s.px}
          quality={isWikimedia ? undefined : appConfig.images.quality}
          unoptimized={isWikimedia}
          className="h-full w-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={cn(
            'text-primary flex h-full w-full items-center justify-center font-semibold',
            s.text,
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );

  if (!tooltip) return avatarNode;

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="inline-flex" />}>
        {avatarNode}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
