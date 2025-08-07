import React from 'react';
import { Property } from '@/types';

type Props = {
  property: Property;
};

const AreaIntel = ({ property }: Props) => {
  const defaultIntel = {
    yield: '5.2%',
    crime: 'Low',
    transport: 'Excellent',
    schools: 'Ofsted Good',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">📍 Area Intelligence</h2>
      <p><strong>Avg. rental yield:</strong> {defaultIntel.yield}</p>
      <p><strong>Crime rate:</strong> {defaultIntel.crime}</p>
      <p><strong>Transport:</strong> {defaultIntel.transport}</p>
      <p><strong>Schools:</strong> {defaultIntel.schools}</p>
    </div>
  );
};

export default AreaIntel;
