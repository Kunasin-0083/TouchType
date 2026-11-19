import React from 'react';
import { generateIllustratedAvatarDataUri } from '../utils/avatarGenerator';

interface UserAvatarProps {
  avatar?: string;
  name?: string;
  seed?: string;
  gradient?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name = '',
  seed = '',
  gradient = 'from-cyan-500 to-blue-600',
  size = 'md',
  className = ''
}) => {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [avatar]);

  const hasCustomImage =
    !imgError &&
    Boolean(avatar) &&
    (avatar!.startsWith('data:image') || avatar!.startsWith('http') || avatar!.startsWith('/'));

  const fallbackPortrait = React.useMemo(
    () => generateIllustratedAvatarDataUri(seed || name || 'player'),
    [seed, name]
  );

  const displaySrc = hasCustomImage ? avatar! : fallbackPortrait;

  const sizeClasses = {
    xs: 'w-6 h-6 rounded-lg text-xs',
    sm: 'w-8 h-8 rounded-xl text-xs',
    md: 'w-10 h-10 rounded-2xl text-sm',
    lg: 'w-14 h-14 rounded-2xl text-base',
    xl: 'w-20 h-20 rounded-3xl text-2xl'
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-tr ${gradient} p-0.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    >
      <img
        src={displaySrc}
        alt={name || 'Profile Avatar'}
        onError={() => {
          if (hasCustomImage) {
            setImgError(true);
          }
        }}
        className="w-full h-full object-cover rounded-[inherit] bg-slate-800/30 select-none"
      />
    </div>
  );
};
