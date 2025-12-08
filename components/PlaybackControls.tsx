
import React from 'react';
import { Play, Pause, FastForward, SkipForward, Calendar, Radio, Wifi, WifiOff } from 'lucide-react';
import { PlaybackSpeed, DataSourceMode, ConnectionStatus } from '../types';

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentSpeed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  progress: number; // 0 to 100
  onSeek: (value: number) => void;
  currentTime: string;
  
  // New props for Live Mode
  dataSource: DataSourceMode;
  onToggleDataSource: () => void;
  connectionStatus: ConnectionStatus;
}

const PlaybackControls: React.FC<Props> = ({
  selectedDate,
  onDateChange,
  isPlaying,
  onTogglePlay,
  currentSpeed,
  onSpeedChange,
  progress,
  onSeek,
  currentTime,
  dataSource,
  onToggleDataSource,
  connectionStatus
}) => {
  const isLive = dataSource === 'LIVE';

  return (
    <div className="bg-gray-850 border border-gray-700 rounded-xl p-4 flex flex-col gap-4 shadow-lg">
      
      {/* Top Row: Date & Main Transport */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Source Toggle */}
        <div className="flex items-center gap-4">
           <button 
             onClick={onToggleDataSource}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
               isLive 
                 ? 'bg-red-600/20 text-red-500 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                 : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
             }`}
           >
             {isLive ? <Wifi size={16} className="animate-pulse" /> : <Calendar size={16} />}
             {isLive ? 'LIVE FEED' : 'HISTORICAL SIM'}
           </button>

           {!isLive && (
             <div className="flex items-center gap-3">
               <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                 <input 
                   type="date" 
                   value={selectedDate}
                   min="2024-04-01"
                   max="2025-11-30"
                   onChange={(e) => onDateChange(e.target.value)}
                   className="bg-gray-900 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-36"
                 />
               </div>
             </div>
           )}

           {isLive && (
              <div className="flex items-center gap-2 text-xs">
                 <span className={`w-2 h-2 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
                 <span className="text-gray-400 uppercase tracking-wider">{connectionStatus}</span>
              </div>
           )}
        </div>

        <div className="font-mono text-xl text-blue-400 font-bold w-20 text-right">
          {currentTime}
        </div>

        {/* Playback Controls (Hidden/Disabled in Live Mode) */}
        {!isLive && (
          <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={onTogglePlay}
              className={`p-2 rounded-md transition-all ${
                isPlaying 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-green-500/20 text-finance-green hover:bg-green-500/30'
              }`}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            
            <div className="w-px h-6 bg-gray-700 mx-1"></div>

            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s as PlaybackSpeed)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                  currentSpeed === s 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {s}x
              </button>
            ))}
            
            <button
              onClick={() => onSpeedChange(100)}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1 ${
                currentSpeed === 100 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              MAX <SkipForward size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Row: Scrubber (Disabled in Live Mode) */}
      <div className={`flex items-center gap-4 transition-opacity ${isLive ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <span className="text-xs text-gray-500 font-mono">09:30</span>
        <input
          type="range"
          min="0"
          max="390" // 390 minutes in a trading day
          value={progress}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-xs text-gray-500 font-mono">16:00</span>
      </div>
    </div>
  );
};

export default PlaybackControls;
