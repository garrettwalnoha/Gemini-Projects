
export interface DataPoint {
  time: string; // HH:MM
  timestamp: number;
  price: number; // This represents the CLOSE price
  open: number;
  high: number;
  low: number;
  volume?: number;      // New: Trading volume
  volumeMA?: number;    // New: Volume Moving Average
  obv?: number;         // New: On-Balance Volume
  predictionForFuture?: number; // Prediction made at this moment for 15 mins later
  predictedPrice?: number; // The value that was predicted FOR this timestamp (calculated 15m ago)
  momentum?: number;
  realizedVolatility?: number; // Standard deviation of returns
  parkinsonVolatility?: number; // High-Low range based volatility
}

// Chart-specific type where price can be null (for future visualization)
export interface ChartDataPoint extends Omit<DataPoint, 'price'> {
  price: number | null;
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface TradeSignal {
  id: string;
  time: string; // Entry Time
  timestamp: number;
  type: SignalType;
  priceAtSignal: number;
  predictedPrice: number;
  
  // Dynamic Trade Result Fields
  exitTime?: string;
  exitPrice?: number;
  durationMinutes?: number;
  
  // Risk Management
  stopLossPrice?: number;
  takeProfitPrice?: number;
  exitReason?: 'CONVERGENCE' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'REVERSAL' | 'EOD' | 'TIME_OUT';

  actualResultPrice?: number; // Legacy field for compatibility
  profit?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface TradeRejection {
  id: string;
  time: string;
  timestamp: number;
  reason: 'EXHAUSTION' | 'TREND_FILTER' | 'LOW_CONVICTION' | 'HIGH_VOLATILITY';
  details: string;
  divergence: number;
  thresholdRequired: number;
}

export interface MarketAnalysis {
  totalGain: number;
  totalTrades: number;
  accuracy: number; // Percentage
  maxDrawdown: number;
  winRate: number;
}

export interface AiAnalysis {
  summary: string;
  riskAssessment: string;
  recommendation: string;
}

export interface Forecast {
  startTime: string;
  startPrice: number;
  endTime: string;
  endPrice: number;
  startTimestamp?: number;
  endTimestamp?: number;
}

export type PlaybackSpeed = 1 | 2 | 5 | 10 | 100; // 100 is "Instant"
