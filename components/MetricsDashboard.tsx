import React from 'react';
import { MarketAnalysis } from '../types';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';

interface Props {
  analysis: MarketAnalysis;
}

const MetricsDashboard: React.FC<Props> = ({ analysis }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Total Gain */}
      <div className={`p-4 rounded-xl border ${analysis.totalGain >= 0 ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Net Profit (Per Share)</p>
            <h3 className={`text-2xl font-bold ${analysis.totalGain >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
              {analysis.totalGain >= 0 ? '+' : ''}{analysis.totalGain}
            </h3>
          </div>
          <div className={`p-2 rounded-full ${analysis.totalGain >= 0 ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
            {analysis.totalGain >= 0 ? <TrendingUp size={24} className="text-finance-green" /> : <TrendingDown size={24} className="text-finance-red" />}
          </div>
        </div>
      </div>

      {/* Accuracy */}
      <div className="p-4 rounded-xl border bg-gray-850 border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Model Accuracy</p>
            <h3 className="text-2xl font-bold text-white">
              {analysis.accuracy}%
            </h3>
          </div>
          <div className="p-2 rounded-full bg-blue-900/50">
            <Target size={24} className="text-blue-400" />
          </div>
        </div>
      </div>

      {/* Total Trades */}
      <div className="p-4 rounded-xl border bg-gray-850 border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Total Trades Executed</p>
            <h3 className="text-2xl font-bold text-white">
              {analysis.totalTrades}
            </h3>
          </div>
          <div className="p-2 rounded-full bg-purple-900/50">
            <Activity size={24} className="text-purple-400" />
          </div>
        </div>
      </div>

      {/* Max Drawdown */}
      <div className="p-4 rounded-xl border bg-gray-850 border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Max Drawdown</p>
            <h3 className="text-2xl font-bold text-orange-400">
              -${analysis.maxDrawdown}
            </h3>
          </div>
          <div className="p-2 rounded-full bg-orange-900/50">
            <TrendingDown size={24} className="text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;