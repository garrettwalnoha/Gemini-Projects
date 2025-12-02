
import React, { useState } from 'react';
import { TradeSignal, SignalType, TradeRejection } from '../types';
import { ArrowUpRight, ArrowDownRight, Clock, Timer, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface Props {
  signals: TradeSignal[];
  rejections?: TradeRejection[];
}

const SignalLog: React.FC<Props> = ({ signals, rejections = [] }) => {
  const [activeTab, setActiveTab] = useState<'trades' | 'analysis'>('trades');

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-700 h-[400px] flex flex-col">
      <div className="border-b border-gray-700 bg-gray-900/50 rounded-t-xl">
         <div className="flex p-2 gap-2">
            <button 
               onClick={() => setActiveTab('trades')}
               className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'trades' 
                  ? 'bg-gray-800 text-white shadow-sm border border-gray-700' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
               }`}
            >
               <ActivityIcon /> Trades <span className="bg-gray-700 text-xs px-1.5 rounded">{signals.length}</span>
            </button>
            <button 
               onClick={() => setActiveTab('analysis')}
               className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'analysis' 
                  ? 'bg-gray-800 text-white shadow-sm border border-gray-700' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
               }`}
            >
               <ShieldCheck size={14} /> Analysis <span className="bg-gray-700 text-xs px-1.5 rounded">{rejections.length}</span>
            </button>
         </div>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {activeTab === 'trades' ? (
           signals.length === 0 ? (
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
          )
        ) : (
          // ANALYSIS TAB CONTENT
          rejections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-4">
               <ShieldCheck size={32} className="mb-2 opacity-50" />
               <p className="text-sm">No significant missed opportunities logged yet.</p>
               <p className="text-xs mt-1 opacity-70">The system logs when a trade signal is detected but rejected by risk filters.</p>
            </div>
          ) : (
            rejections.slice().reverse().map((rej) => (
               <div key={rej.id} className="p-3 rounded-lg bg-gray-900/30 border border-gray-700/50 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono text-xs">{rej.time}</span>
                        <Badge reason={rej.reason} />
                     </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                     {rej.details}
                  </p>
               </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

const Badge = ({ reason }: { reason: TradeRejection['reason'] }) => {
   switch(reason) {
      case 'EXHAUSTION':
         return <span className="bg-orange-900/40 text-orange-400 text-[10px] px-1.5 py-0.5 rounded border border-orange-800">Market Exhaustion</span>;
      case 'TREND_FILTER':
         return <span className="bg-blue-900/40 text-blue-400 text-[10px] px-1.5 py-0.5 rounded border border-blue-800">Fighting Trend</span>;
      case 'HIGH_VOLATILITY':
         return <span className="bg-red-900/40 text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-red-800">High Volatility</span>;
      default:
         return <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded border border-gray-700">Low Conviction</span>;
   }
}

const ActivityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

export default SignalLog;
