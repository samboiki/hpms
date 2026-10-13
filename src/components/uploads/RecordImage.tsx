import React, { useEffect, useState } from 'react';
import { recordLink } from '../../services/recordFiles';

interface RecordImageProps {
  /** The stored path (or, in rows written before the move, the stored link) */
  path: string;
  /** The row's bucket column, when its table has one */
  bucket?: string | null;
  alt: string;
  className?: string;
}

/**
 * A stored photo or scan of a patient record. Records have no public link: a short-lived one is made when the image
 * is shown. Until it arrives (or if it cannot be made) a grey box of the same size holds the place.
 */
const RecordImage: React.FC<RecordImageProps> = ({ path, bucket, alt, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setSrc(null);
    recordLink(path, bucket).then(
      link => { if (current) setSrc(link); },
      () => { if (current) setSrc(null); }
    );
    return () => { current = false; };
  }, [path, bucket]);

  return src
    ? <img src={src} alt={alt} className={className} />
    : <span role="img" aria-label={alt} className={`block bg-gray-100 ${className}`} />;
};

export default RecordImage;
