
import React, { useEffect, useState, useRef } from 'react';
import { generateMarketData, runPredictionAlgorithm, trainModel } from './services/marketSimulator';
import { getGeminiAnalysis } from './services/geminiService';
import { DataPoint, TradeSignal, MarketAnalysis, PlaybackSpeed, Forecast, TradeRejection } from './types';
import StockChart from './components/StockChart';
import MetricsDashboard from './components/MetricsDashboard';
import SignalLog from './components/SignalLog';
import PlaybackControls from './components/PlaybackControls';
import { Bot, AlertCircle, BrainCircuit } from 'lucide-react';

const App: React.FC = () => {
  // --- Data State ---
  const [fullDayData, setFullDayData] = useState<DataPoint[]>([]);
  const [fullDaySignals, setFullDaySignals] = useState<TradeSignal[]>([]);
  const [fullDayRejections, setFullDayRejections] = useState<TradeRejection[]>([]);
  const [fullDayStats, setFullDayStats] = useState<MarketAnalysis | null>(null);
  
  // Model Training State
  const [modelParams, setModelParams] = useState<any>(null);

  // --- Playback State ---
  // Default to the user requested Nov 30, 2025
  const [currentDate, setCurrentDate] = useState<string>('2025-11-30');
  const [playbackIndex, setPlaybackIndex] = useState<number>(0); 
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  
  // --- AI State ---
  const [aiReport, setAiReport] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);

  // --- Derived State for UI ---
  const visibleData = fullDayData.slice(0, playbackIndex + 1);
  
  const visibleSignals = fullDaySignals.filter(s => {
    const signalIndex = fullDayData.findIndex(d => d.timestamp === s.timestamp);
    return signalIndex !== -1 && signalIndex <= playbackIndex;
  });

  const visibleRejections = fullDayRejections.filter(r => {
      const rejIndex = fullDayData.findIndex(d => d.timestamp === r.timestamp);
      return rejIndex !== -1 && rejIndex <= playbackIndex;
  });

  // Identify if there is currently an ACTIVE trade at this playback moment
  const currentActiveTrade = React.useMemo(() => {
    // Find a signal that started before current time but hasn't "closed" yet in the playback timeline
    const currentTimestamp = visibleData[visibleData.length - 1]?.timestamp;
    if (!currentTimestamp) return null;

    return fullDaySignals.find(s => {
       const exitTimestamp = fullDayData.find(d => d.time === s.exitTime)?.timestamp;
       if (!exitTimestamp) return false;
       return s.timestamp <= currentTimestamp && exitTimestamp > currentTimestamp;
    });
  }, [fullDaySignals, visibleData, fullDayData]);


  const currentStats: MarketAnalysis = React.useMemo(() => {
    if (!fullDayStats) return { totalGain: 0, totalTrades: 0, accuracy: 0, maxDrawdown: 0, winRate: 0 };
    
    // Only count closed trades visible so far
    const closedVisible = visibleSignals.filter(s => {
       const exitTimestamp = fullDayData.find(d => d.time === s.exitTime)?.timestamp;
       const currentTimestamp = visibleData[visibleData.length - 1]?.timestamp || 0;
       return exitTimestamp && exitTimestamp <= currentTimestamp;
    });

    const runningPnL = closedVisible.reduce((acc, curr) => acc + (curr.profit || 0), 0);
    const wins = closedVisible.filter(s => (s.profit || 0) > 0).length;
    const total = closedVisible.length;
    
    let peak = 0;
    let dd = 0;
    let r = 0;
    closedVisible.forEach(s => {
      r += s.profit || 0;
      if (r > peak) peak = r;
      if (peak - r > dd) dd = peak - r;
    });

    return {
      totalGain: parseFloat(runningPnL.toFixed(2)),
      totalTrades: total,
      accuracy: total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0,
      maxDrawdown: parseFloat(dd.toFixed(2)),
      winRate: total > 0 ? wins / total : 0
    };
  }, [visibleSignals, fullDayStats, visibleData, fullDayData]);

  // Calculate current forecast projection
  // This projects from the CURRENT playback head into the FUTURE
  const currentForecast: Forecast | null = React.useMemo(() => {
    if (visibleData.length === 0) return null;
    
    const currentPoint = visibleData[visibleData.length - 1];
    
    // We stored the prediction MADE at this time in `predictionForFuture`
    if (currentPoint.predictionForFuture) {
      // We need to calculate the END time string
      // The prediction horizon is 15 minutes
      const endTimeUnix = currentPoint.timestamp + (15 * 60000);
      const endTimeStr = new Date(endTimeUnix).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return {
        startTime: currentPoint.time,
        startTimestamp: currentPoint.timestamp,
        startPrice: currentPoint.price,
        endTime: endTimeStr,
        endTimestamp: endTimeUnix,
        endPrice: currentPoint.predictionForFuture
      };
    }
    return null;
  }, [visibleData]);

  // --- Simulation Logic ---

  useEffect(() => {
    // 1. Train the model on prior days in the month
    const params = trainModel(currentDate);
    setModelParams(params);

    // 2. Generate and Process Data using Learned Parameters
    const rawData = generateMarketData(currentDate);
    const { processedData, signals, rejections, analysis } = runPredictionAlgorithm(rawData, params);
    
    setFullDayData(processedData);
    setFullDaySignals(signals);
    setFullDayRejections(rejections);
    setFullDayStats(analysis);
    
    setPlaybackIndex(0);
    setIsPlaying(false);
    setAiReport("");
  }, [currentDate]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isPlaying && playbackIndex < fullDayData.length - 1) {
      const msPerTick = speed === 100 ? 10 : 1000 / speed; 
      
      interval = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= fullDayData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, msPerTick);
    }

    return () => clearInterval(interval);
  }, [isPlaying, speed, fullDayData.length, playbackIndex]);

  useEffect(() => {
    if (playbackIndex === fullDayData.length - 1 && fullDayData.length > 0 && !aiReport && !isLoadingAi) {
      fetchAiAnalysis(fullDayStats!, fullDaySignals);
    }
  }, [playbackIndex, fullDayData.length]);

  const fetchAiAnalysis = async (analysis: MarketAnalysis, recentSignals: TradeSignal[]) => {
    setIsLoadingAi(true);
    const report = await getGeminiAnalysis(analysis, recentSignals);
    setAiReport(report);
    setIsLoadingAi(false);
  };

  const handleSeek = (val: number) => {
    const newIndex = Math.min(Math.max(0, val), fullDayData.length - 1);
    setPlaybackIndex(newIndex);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 font-sans text-gray-100">
      
      <header className="max-w-7xl mx-auto mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SPY Predictor <span className="text-xl font-normal text-gray-500">| 15m Horizon</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Historical Simulator • Online LMS Learning • Real-time Forecasting
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        
        <PlaybackControls 
          selectedDate={currentDate}
          onDateChange={setCurrentDate}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          currentSpeed={speed}
          onSpeedChange={setSpeed}
          progress={playbackIndex}
          onSeek={handleSeek}
          currentTime={visibleData[visibleData.length - 1]?.time || "09:30"}
        />

        {/* Adaptive Model Status Bar */}
        {modelParams && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-3">
                 <div className="bg-purple-900/30 p-2 rounded-full text-purple-400">
                    <BrainCircuit size={18} />
                 </div>
                 <div>
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">AI Regime Detection</div>
                    <div className="text-sm text-gray-200 font-medium">{modelParams.description}</div>
                 </div>
              </div>
              <div className="flex flex-col justify-center">
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Trend Bias (Adaptive)</span>
                    <span className={modelParams.trendBias > 0 ? 'text-green-400' : 'text-red-400'}>
                       {modelParams.trendBias > 0 ? 'Bullish' : 'Bearish'} ({modelParams.trendBias.toFixed(2)})
                    </span>
                 </div>
                 <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${modelParams.trendBias > 0 ? 'bg-green-500' : 'bg-red-500'}`} 
                      style={{ width: `${Math.abs(modelParams.trendBias) * 100}%` }}
                    />
                 </div>
              </div>
              <div className="flex flex-col justify-center border-l border-gray-800 pl-4">
                 <div className="text-xs text-gray-500">Base Volatility Multiplier</div>
                 <div className="text-sm text-white font-mono">
                    x{modelParams.baseVolatilityThreshold.toFixed(2)} 
                    <span className="text-gray-600 ml-1 text-xs">Dynamic scaling active</span>
                 </div>
              </div>
           </div>
        )}

        <MetricsDashboard analysis={currentStats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            <StockChart 
              data={visibleData} 
              signals={visibleSignals} 
              forecast={currentForecast}
              activeTrade={currentActiveTrade}
            />
            
            <div className="bg-gray-850 border border-gray-700 rounded-xl p-6 relative overflow-hidden min-h-[200px]">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Bot size={120} />
              </div>
              
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Bot className="text-purple-400" /> 
                  End-of-Day AI Analyst Report
                </h3>
                
                {playbackIndex < fullDayData.length - 1 ? (
                  <div className="text-gray-500 italic text-sm border-l-2 border-gray-700 pl-4">
                    Analysis will generate automatically when the trading session completes (16:00).
                  </div>
                ) : isLoadingAi ? (
                  <div className="flex items-center gap-3 text-gray-400 animate-pulse">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    Processing session data...
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-line">
                      {aiReport || "Analysis unavailable."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
             <SignalLog signals={visibleSignals} rejections={visibleRejections} />
             
             <div className="mt-6 bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex gap-3">
               <AlertCircle className="text-blue-400 shrink-0" size={20} />
               <div className="text-xs text-blue-200/80">
                 <strong>Simulation Mode:</strong>
                 {currentDate.startsWith('2025') 
                    ? " Showing Projected SPY performance for November 2025 (Hypothetical Scenarios)."
                    : ` Showing SPY close data for ${currentDate}.`
                 }
                 <br/><br/>
                 <strong>Online Learning (LMS):</strong> The prediction engine uses Least Mean Squares to adjust model weights (Momentum, OBV, Volatility) every minute based on prediction errors.
               </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;