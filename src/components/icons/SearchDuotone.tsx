import React from 'react';

interface SearchDuotoneProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const SearchDuotone: React.FC<SearchDuotoneProps> = ({ 
  className = "w-5 h-5",
  primaryColor = "currentColor",
  secondaryColor = "currentColor"
}) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none"
      className={className}
    >
      <path 
        opacity="0.5" 
        d="M20.3133 11.1566C20.3133 16.2137 16.2137 20.3133 11.1566 20.3133C6.09956 20.3133 2 16.2137 2 11.1566C2 6.09956 6.09956 2 11.1566 2C16.2137 2 20.3133 6.09956 20.3133 11.1566Z" 
        fill={secondaryColor}
      />
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M18.8382 18.8382C19.1205 18.5559 19.5783 18.5559 19.8606 18.8382L21.7954 20.773C22.0777 21.0553 22.0777 21.5131 21.7954 21.7954C21.5131 22.0777 21.0553 22.0777 20.773 21.7954L18.8382 19.8606C18.5559 19.5783 18.5559 19.1205 18.8382 18.8382Z" 
        fill={primaryColor}
      />
    </svg>
  );
};

export default SearchDuotone;