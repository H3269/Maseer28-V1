import React, { useEffect, useState } from 'react';
import {
  formatPublishedAtFa,
  isValidReleaseMetadata,
  toPersianDigits,
} from '../releaseMetadata.js';

export default function VersionFooter({ navVisible = false }) {
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}version.json?refresh=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('release_metadata_unavailable');
        return response.json();
      })
      .then((value) => {
        if (!cancelled && isValidReleaseMetadata(value)) setMetadata(value);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!metadata) return null;

  const version = toPersianDigits(metadata.version);
  const isPreview = metadata.channel === 'preview';
  const date = isPreview ? '' : formatPublishedAtFa(metadata.publishedAt);

  return (
    <aside className={`releaseFooter${navVisible ? ' with-nav' : ' without-nav'}`} dir="rtl" aria-label="اطلاعات نسخه برنامه">
      {isPreview
        ? <span>نسخه آزمایشی {version}</span>
        : <><span>نسخه {version}</span><span className="releaseFooterDivider" aria-hidden="true">|</span><span>آخرین انتشار: {date}</span></>}
    </aside>
  );
}
