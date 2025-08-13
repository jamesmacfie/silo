import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps): JSX.Element {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div 
      className={`card ${className} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps): JSX.Element {
  return (
    <div className={`cardHead ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps): JSX.Element {
  return (
    <div className={`card-content ${className}`}>
      {children}
    </div>
  );
}

interface CardActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function CardActions({ children, className = '' }: CardActionsProps): JSX.Element {
  return (
    <div className={`actions ${className}`}>
      {children}
    </div>
  );
}