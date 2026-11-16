import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
  avatar?: string;
  name?: string;
  gradient?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name = '',
  gradient = 'from-cyan-500 to-blue-600',
  size = 'md',
  className = ''
}) => {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [avatar]);

  const isImage =
    !imgError &&
    Boolean(avatar) &&
    (avatar!.startsWith('data:image') || avatar!.startsWith('http') || avatar!.startsWith('/'));

  const sizeClasses = {
    xs: 'w-6 h-6 rounded-lg text-xs',
    sm: 'w-8 h-8 rounded-xl text-xs',
    md: 'w-10 h-10 rounded-2xl text-sm',
    lg: 'w-14 h-14 rounded-2xl text-base',
    xl: 'w-20 h-20 rounded-3xl text-2xl'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-9 h-9'
  };

  // Get 1st letter initial
  const cleanName = name.replace(/^(นาย|นางสาว|ด\.ช\.|ด\.ญ\.|ครู|อาจารย์)\s*/i, '').trim();
  const initial = cleanName ? cleanName.charAt(0).toUpperCase() : '';

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-tr ${gradient} p-0.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    >
      {isImage ? (
        <img
          src={avatar}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      ) : (
        <div className="w-full h-full rounded-[inherit] bg-slate-950/20 backdrop-blur-xs flex items-center justify-center font-bold text-white uppercase select-none">
          {initial ? (
            <span>{initial}</span>
          ) : (
            <UserIcon className={`${iconSizes[size]} text-white`} />
          )}
        </div>
      )}
    </div>
  );
};
