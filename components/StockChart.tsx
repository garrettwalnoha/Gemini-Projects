
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { DataPoint, TradeSignal, SignalType, Forecast } from '../types';

interface Props {
  data: DataPoint[];
  signals: TradeSignal[];
  forecast?: Forecast | null;
  activeTrade?: Partial<TradeSignal> | null; // Pass active trade to visualize SL/TP
  fullDayDomain?: boolean; 
}

const StockChart: React.FC<Props> = ({ data, signals, forecast, activeTrade, fullDayDomain = true }) => {
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as DataPoint;
      const forecastVal = dataPoint.predictionForFuture;
      const historicPred = dataPoint.predictedPrice;

      // Format timestamp for label
      const timeLabel = new Date(dataPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return (
        <div className="bg-gray-850 border border-gray-700 p-3 rounded shadow-xl z-50 min-w-[200px]">
          <p className="text-gray-300 font-bold mb-2 border-b border-gray-700 pb-1">{timeLabel}</p>
          
          {payload.map((entry: any, index: number) => {
            let name = entry.name;
            if (name === 'Forecast') return null; 
            return (
              <div key={index} className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                   {entry.name === 'Model Prediction' ? (
                     <div className="w-4 h-0.5 bg-[#d946ef] border-t border-dashed border-white" />
                   ) : (
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                   )}
                   <span className="text-sm text-gray-400">{name}:</span>
                </div>
                <span className="text-sm font-mono text-white font-medium">{entry.value}</span>
              </div>
            );
          })}

          {/* Historic Accuracy (if both exist) */}
          {historicPred && (
             <div className="mt-1 pt-1 border-t border-gray-700/50">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-gray-500">Prediction Error:</span>
                 <span className={`font-mono ${Math.abs(dataPoint.price - historicPred) < 0.1 ? 'text-green-400' : 'text-red-400'}`}>
                   {(dataPoint.price - historicPred).toFixed(2)}
                 </span>
               </div>
             </div>
          )}
          
          {/* AI Future Target Display */}
          {forecastVal && (
             <div className="flex items-center justify-between gap-4 mt-2 bg-purple-900/20 p-1 rounded">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                   <span className="text-xs text-purple-300">AI Target (15m):</span>
                </div>
                <span className="text-xs font-mono text-purple-200 font-bold">{forecastVal.toFixed(2)}</span>
             </div>
          )}

          {/* Volatility Metrics Section */}
          <div className="mt-2 pt-2 border-t border-gray-700">
             <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs text-gray-500">Intraday Vol (30m):</span>
                <span className="text-xs font-mono text-gray-300">{dataPoint.realizedVolatility?.toFixed(2) || '0.00'}</span>
             </div>
             <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs text-gray-500">Parkinson Vol:</span>
                <span className="text-xs font-mono text-gray-300">{dataPoint.parkinsonVolatility?.toFixed(2) || '0.00'}</span>
             </div>

             {/* Volume Metrics Section */}
             <div className="border-t border-gray-700 pt-2">
               <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-xs text-blue-400">Volume:</span>
                  <span className="text-xs font-mono text-gray-300">{(dataPoint.volume || 0).toLocaleString()}</span>
               </div>
               <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-purple-400">OBV:</span>
                  <span className="text-xs font-mono text-gray-300">{(dataPoint.obv || 0).toLocaleString()}</span>
               </div>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Generate hourly ticks based on the actual date of the data
  const getDayBounds = () => {
    if (data.length === 0) return { start: 0, end: 0, ticks: [] };
    const first = new Date(data[0].timestamp);
    const start = new Date(first);
    start.setHours(9, 30, 0, 0);
    const end = new Date(first);
    end.setHours(16, 0, 0, 0);
    
    const ticks = [];
    let current = new Date(start);
    // Add ticks for every hour from 9:30 to 16:00
    while (current <= end) {
      ticks.push(current.getTime());
      current.setMinutes(current.getMinutes() + 60); 
    }
    // Ensure 9:30 and 16:00 are explicitly included if logic skipped them
    if (ticks[0] !== start.getTime()) ticks.unshift(start.getTime());
    
    return { start: start.getTime(), end: end.getTime(), ticks };
  }

  const { start, end, ticks } = getDayBounds();

  // Calculate Y-Domain padding
  const yValues = data.map(d => d.price);
  
  // Include predictedPrice in domain calculation so the line isn't cut off
  data.forEach(d => {
      if (d.predictedPrice !== undefined && !isNaN(d.predictedPrice)) {
          yValues.push(d.predictedPrice);
      }
  });

  if (forecast) yValues.push(forecast.endPrice);
  
  const minP = Math.min(...yValues);
  const maxP = Math.max(...yValues);
  const range = maxP - minP;
  // Ensure we have a valid range even if flat
  const safeRange = range === 0 ? maxP * 0.01 : range;
  const yDomain: [number, number] = [minP - safeRange * 0.1, maxP + safeRange * 0.1];

  return (
    <div className="w-full h-[400px] bg-gray-900/50 rounded-xl border border-gray-800 p-4 relative">
      <h3 className="text-gray-400 text-sm font-medium mb-4 absolute top-4 left-4 z-10 flex items-center gap-2">
        SPY Price Action
        {forecast && (
           <span className="flex items-center gap-1 text-[10px] bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
             <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"/>
             Live Forecast Active
           </span>
        )}
      </h3>
      
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
          
          <XAxis 
            dataKey="timestamp" 
            type="number"
            domain={fullDayDomain ? [start, end] : ['auto', 'auto']}
            ticks={fullDayDomain ? ticks : undefined}
            tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#718096" 
            tick={{ fill: '#718096', fontSize: 12 }} 
            interval={0} // Force all provided ticks to render
          />
          
          <YAxis 
            domain={yDomain} 
            stroke="#718096" 
            tick={{ fill: '#718096', fontSize: 12 }} 
            width={50}
            allowDataOverflow={false} 
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          {/* Actual Price Line */}
          <Line
            type="monotone"
            dataKey="price"
            name="Actual Price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false} 
          />

          {/* Model Prediction Line (Dashed) */}
          <Line
            type="monotone"
            dataKey="predictedPrice"
            name="Model Prediction"
            stroke="#d946ef" 
            strokeWidth={2.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Live Forecast Vector */}
          {forecast && forecast.startTimestamp && forecast.endTimestamp && (
            <ReferenceLine
              segment={[
                { x: forecast.startTimestamp, y: forecast.startPrice },
                { x: forecast.endTimestamp, y: forecast.endPrice }
              ]}
              stroke="#d946ef"
              strokeWidth={2}
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
          )}
          
          {/* Active Trade Stop Loss & Take Profit Visualization */}
          {activeTrade && activeTrade.stopLossPrice && (
            <ReferenceLine 
              y={activeTrade.stopLossPrice} 
              stroke="#ef4444" 
              strokeDasharray="3 3" 
              label={{ position: 'right', value: 'SL', fill: '#ef4444', fontSize: 10 }}
            />
          )}
          {activeTrade && activeTrade.takeProfitPrice && (
            <ReferenceLine 
              y={activeTrade.takeProfitPrice} 
              stroke="#10b981" 
              strokeDasharray="3 3" 
              label={{ position: 'right', value: 'TP', fill: '#10b981', fontSize: 10 }}
            />
          )}

          {/* Render Signal Dots */}
          {signals.map((signal) => (
             <ReferenceDot
               key={signal.id}
               x={signal.timestamp} // Use timestamp for x coordinate
               y={signal.priceAtSignal}
               r={5}
               fill={signal.type === SignalType.BUY ? '#00c805' : '#ff3b30'}
               stroke="#fff"
               strokeWidth={1}
             />
          ))}

        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;