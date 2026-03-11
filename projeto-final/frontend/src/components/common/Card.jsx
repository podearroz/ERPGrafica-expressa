import React from 'react';

const Card = ({ title, icon: Icon, children, className = '' }) => {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-slate-600" />}
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          </div>
        </div>
      )}
      <div className={title ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

export default Card;
