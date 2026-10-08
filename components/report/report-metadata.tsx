import React from 'react';

export default function ReportMetadata({ 
  generatedAt, 
  requestedBy 
}: { 
  generatedAt: string;
  requestedBy: string;
}) {
  return (
    <div className="text-sm text-gray-500 flex justify-between">
      <span>Generated at: {new Date(generatedAt).toLocaleString()}</span>
      <span>Requested by: {requestedBy}</span>
    </div>
  );
}
