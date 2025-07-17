'use client';

import React from 'react';

export default function MapView() {
  return (
    <div
      style={{
        flex: '1 1 40%',
        height: '100%',
        minHeight: '500px',
        marginLeft: '20px',
        borderRadius: '10px',
        backgroundColor: '#f1f5f9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: '500',
        color: '#1f2937',
        transition: 'all 0.2s ease',
      }}
      className="map-view"
    >
      🗺 Map view (placeholder)
    </div>
  );
}