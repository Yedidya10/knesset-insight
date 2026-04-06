'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { appConfig } from '../../../app.config';

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
  const showImage = member.imageUrl && !imgError;

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

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full bg-primary/10',
        s.container,
        ring,
        className,
      )}
      title={tooltip}
    >
      {showImage ? (
        <Image
          src={member.imageUrl!}
          alt={`${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()}
          width={s.px}
          height={s.px}
          quality={appConfig.images.quality}
          className="h-full w-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center font-semibold text-primary',
            s.text,
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
