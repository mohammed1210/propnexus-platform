import React from 'react';
import { Property } from '@/types';
import { FaChartLine, FaShieldAlt, FaBus, FaSchool } from 'react-icons/fa';

type Props = {
  property: Property;
};

const AreaIntel = ({ property }: Props) => {
  const defaultIntel = {
    yield: '5.2%',
    crime: 'Low vs national',
    transport: 'Excellent · ~18 mins to centre',
    schools: 'Ofsted Good',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-2 flex items-center">
        📍 Area Intelligence
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        A quick snapshot of rental demand and liveability around{" "}
        <span className="font-semibold">{property.postcode || "postcode"}</span>.
      </p>

      <div className="space-y-4">
        {/* Yield */}
        <div className="flex items-start">
          <FaChartLine className="text-blue-500 mt-1 mr-3" size={20} />
          <div>
            <p className="font-medium">Avg. rental yield</p>
            <p>{defaultIntel.yield}</p>
            <p className="text-xs text-gray-500">
              Useful for quick rent-vs-price sense-check.
            </p>
          </div>
        </div>

        {/* Crime */}
        <div className="flex items-start">
          <FaShieldAlt className="text-green-500 mt-1 mr-3" size={20} />
          <div>
            <p className="font-medium">Crime rate</p>
            <p>{defaultIntel.crime}</p>
            <p className="text-xs text-gray-500">
              Lower crime can support stronger tenant demand and lower void risk.
            </p>
          </div>
        </div>

        {/* Transport */}
        <div className="flex items-start">
          <FaBus className="text-purple-500 mt-1 mr-3" size={20} />
          <div>
            <p className="font-medium">Transport</p>
            <p>{defaultIntel.transport}</p>
            <p className="text-xs text-gray-500">
              Good links typically increase rental pool and reduce time-to-let.
            </p>
          </div>
        </div>

        {/* Schools */}
        <div className="flex items-start">
          <FaSchool className="text-yellow-500 mt-1 mr-3" size={20} />
          <div>
            <p className="font-medium">Schools</p>
            <p>{defaultIntel.schools}</p>
            <p className="text-xs text-gray-500">
              Strong schools often support family demand and longer tenancies.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Figures are illustrative for product design. Live data sources coming soon (ONS, Police, Ofsted, TfL/National Rail).
      </p>
    </div>
  );
};

export default AreaIntel;
