
import React from 'react';
import { TradeSignal, SignalType } from '../types';
import { ArrowUpRight, ArrowDownRight, Clock, Timer } from 'lucide-react';

interface Props {
  signals: TradeSignal[];
}

const SignalLog: React.FC<Props> = ({ signals }) => {
  return (
    <div className="bg-gray-850 rounded-xl border border-gray-700 h-[400px] flex flex-col">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
        <h3 className="text-white font-medium flex items-center gap-2">
          <ActivityIcon /> Trade Journal
        </h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {signals.length} Closed
        </span>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Clock size={32} className="mb-2 opacity-50" />
            <p>No completed trades yet.</p>
          </div>
        ) : (
          signals.slice().reverse().map((signal) => (
            <div 
              key={signal.id} 
              className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  signal.type === SignalType.BUY ? 'bg-green-900/30 text-finance-green' : 'bg-red-900/30 text-finance-red'
                }`}>
                  {signal.type === SignalType.BUY ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${
                      signal.type === SignalType.BUY ? 'text-finance-green' : 'text-finance-red'
                    }`}>
                      {signal.type}
                    </span>
                    <span className="text-gray-500 text-xs">@ {signal.time}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Open: <span className="text-gray-200">${signal.priceAtSignal.toFixed(2)}</span>
                    <span className="mx-1">•</span>
                    Close: <span className="text-gray-200">${signal.exitPrice?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mb-0.5">
                   <Timer size={10} /> {signal.durationMinutes}m
                </div>
                <div className={`font-mono font-medium text-sm ${
                  (signal.profit || 0) > 0 ? 'text-finance-green' : 'text-finance-red'
                }`}>
                  {(signal.profit || 0) > 0 ? '+' : ''}{signal.profit?.toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

export default SignalLog;
