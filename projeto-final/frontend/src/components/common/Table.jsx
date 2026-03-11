import React from 'react';

const Table = ({ headers, children }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header, index) => (
              <th 
                key={index}
                className={`px-6 py-3 text-xs font-semibold text-slate-600 uppercase ${
                  header.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {children}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
