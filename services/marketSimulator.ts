
import { DataPoint, TradeSignal, SignalType, MarketAnalysis, TradeRejection } from '../types';
import { getRealDataForDate, getPriorDaysInMonth } from './spyData';

// Constants for simulation
const START_PRICE_BASE = 545.00;
const MARKET_OPEN_MINUTES = 390; // 6.5 hours * 60 minutes
const START_HOUR = 9;
const START_MINUTE = 30;

interface ModelParameters {
  trendBias: number;        // -1 (Bearish) to 1 (Bullish)
  baseVolatilityThreshold: number; // Multiplier for entry threshold derived from macro vol
  momentumWeight: number;    // Initial momentum weight
  description: string;       // Text description of the learned regime
}

// Default parameters if no training data exists
const DEFAULT_PARAMS: ModelParameters = {
  trendBias: 0,
  baseVolatilityThreshold: 1.0,
  momentumWeight: 0.5,
  description: "Baseline (No Prior Data)"
};

// Simple seeded random number generator (Linear Congruential Generator)
class SeededRandom {
  private seed: number;

  constructor(seedStr: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    }
    this.seed = h;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Trains the model on prior days in the month to establish regime parameters.
 * Gives greater weight to more recent data (Exponential Decay).
 * Updated: Uses consecutive trend days for better regime detection.
 */
export const trainModel = (currentDate: string): ModelParameters => {
  const history = getPriorDaysInMonth(currentDate);
  
  if (history.length === 0) return DEFAULT_PARAMS;

  let weightedReturnSum = 0;
  let weightedVolSum = 0;
  let weightSum = 0;
  
  // Trend Persistence: Count consecutive days with same sign as most recent
  let consecutiveTrendDays = 0;
  if (history.length > 0) {
    const lastDayDir = history[history.length - 1].close > history[history.length - 1].open ? 1 : -1;
    for (let i = history.length - 1; i >= 0; i--) {
        const dayDir = history[i].close > history[i].open ? 1 : -1;
        if (dayDir === lastDayDir) consecutiveTrendDays += dayDir;
        else break;
    }
  }

  // Recent data gets higher weight
  history.forEach((day, index) => {
    // Exponential weight: latest day has weight 1.0, previous has 0.85, etc.
    const recencyWeight = Math.pow(0.85, history.length - 1 - index);
    
    const dailyReturn = (day.close - day.open) / day.open;
    const dailyVol = (day.high - day.low) / day.open;

    weightedReturnSum += (!isNaN(dailyReturn) ? dailyReturn : 0) * recencyWeight;
    weightedVolSum += (!isNaN(dailyVol) ? dailyVol : 0) * recencyWeight;
    weightSum += recencyWeight;
  });

  const avgWeightedReturn = weightSum > 0 ? weightedReturnSum / weightSum : 0;
  const avgWeightedVol = weightSum > 0 ? weightedVolSum / weightSum : 0;

  // Determine Parameters
  // 1. Trend Bias: Enhanced with persistence check
  // If we have 3+ up days in a row, boost the bias significantly
  let trendBias = Math.min(Math.max(avgWeightedReturn * 100, -1), 1);
  if (Math.abs(consecutiveTrendDays) >= 3) {
      trendBias *= 1.5; // Amplify bias in persistent trends
  }
  
  // 2. Base Volatility Threshold (Macro)
  // If historical vol is high (>1%), be more conservative
  let baseVolatilityThreshold = 1.0;
  if (avgWeightedVol > 0.012) baseVolatilityThreshold = 1.5; 
  else if (avgWeightedVol < 0.005) baseVolatilityThreshold = 0.8; 
  
  // 3. Momentum Weight: In strong trends, trust momentum.
  // Boosted base momentum weight for better signal capture
  const momentumWeight = Math.abs(trendBias) > 0.2 ? 1.5 : 1.0;

  let description = "";
  if (trendBias > 0.1) description = "Bullish Trend";
  else if (trendBias < -0.1) description = "Bearish Trend";
  else description = "Choppy / Neutral";
  
  if (Math.abs(consecutiveTrendDays) >= 3) description += " (Persistent)";
  description += avgWeightedVol > 0.01 ? " [High Vol]" : " [Stable]";

  return {
    trendBias: !isNaN(trendBias) ? trendBias : 0,
    baseVolatilityThreshold: !isNaN(baseVolatilityThreshold) ? baseVolatilityThreshold : 1.0,
    momentumWeight: !isNaN(momentumWeight) ? momentumWeight : 1.0,
    description
  };
};

/**
 * Enriches data with synthetic Open, High, Low, and Volume values.
 */
const enrichMarketData = (data: DataPoint[], rng: SeededRandom): DataPoint[] => {
  return data.map((point, index) => {
    // If it's the first point, O=H=L=C approximately
    if (index === 0) {
      return { 
        ...point, 
        open: point.price, 
        high: point.price, 
        low: point.price,
        volume: Math.floor(rng.range(10000, 50000))
      };
    }

    const prev = data[index - 1];
    const open = prev.price; 
    
    // High and Low need to envelop the Open and Close
    const volatilityNoise = rng.range(0.02, 0.15); 
    const maxVal = Math.max(open, point.price);
    const minVal = Math.min(open, point.price);
    
    const high = parseFloat((maxVal + rng.range(0, volatilityNoise)).toFixed(2));
    const low = parseFloat((minVal - rng.range(0, volatilityNoise)).toFixed(2));

    // Synthesize Volume
    const priceChange = Math.abs(point.price - prev.price);
    const baseVolume = 20000;
    const changeMultiplier = 80000; 
    const volumeNoise = rng.range(-5000, 15000);
    
    // Simulate "Lunch Lull"
    let timeMultiplier = 1.0;
    if (index > 120 && index < 240) timeMultiplier = 0.6; 
    if (index < 30 || index > 360) timeMultiplier = 1.5; 

    const volume = Math.floor((baseVolume + (priceChange * changeMultiplier) + volumeNoise) * timeMultiplier);

    return {
      ...point,
      open,
      high,
      low,
      volume: volume > 1000 ? volume : 1000 
    };
  });
};

/**
 * Generates market data. 
 */
export const generateMarketData = (dateStr: string): DataPoint[] => {
  const rng = new SeededRandom(dateStr);
  let rawData: DataPoint[] = [];

  // 1. Try to get real data
  const realData = getRealDataForDate(dateStr);
  if (realData) {
    rawData = realData;
  } else {
    // 2. Fallback to Generator
    const data: DataPoint[] = [];
    const startPrice = START_PRICE_BASE + rng.range(-10, 10);
    let currentPrice = startPrice;
    
    const dateObj = new Date(dateStr);
    dateObj.setHours(START_HOUR, START_MINUTE, 0, 0);
    
    const volatility = rng.range(0.15, 0.45); 
    const dailyTrendBias = rng.range(-0.02, 0.03); 
    
    for (let i = 0; i <= MARKET_OPEN_MINUTES; i++) {
      const timestamp = dateObj.getTime() + i * 60000;
      const timeString = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const randomShock = (rng.next() - 0.5) * volatility;
      const cycle = Math.sin(i / rng.range(40, 90)) * rng.range(0.2, 0.6);
      
      currentPrice = currentPrice + randomShock + dailyTrendBias + (cycle * 0.1);
      
      data.push({
        time: timeString,
        timestamp,
        price: parseFloat(currentPrice.toFixed(2)),
        open: 0, high: 0, low: 0, volume: 0 
      });
    }
    rawData = data;
  }

  // Enrich with OHLC and Volume
  return enrichMarketData(rawData, rng);
};

/**
 * The Core Algorithm: Weighted Prediction with Online Learning (LMS) & Dynamic Risk Management
 */
export const runPredictionAlgorithm = (
  rawData: DataPoint[], 
  modelParams: ModelParameters = DEFAULT_PARAMS
): { processedData: DataPoint[], signals: TradeSignal[], rejections: TradeRejection[], analysis: MarketAnalysis } => {
  
  // ADJUSTMENT: Lookback Window for better stability
  const LOOKBACK_WINDOW = 30; // 30 minutes
  const SMA_SMOOTHING = 5;    // Smoothing window for momentum calculation
  const PREDICTION_HORIZON = 15; 
  const VOLATILITY_WINDOW = 30;
  const VOLUME_MA_WINDOW = 5;
  
  // New: Maximum duration a trade should remain open if it hasn't hit targets
  const MAX_TRADE_DURATION_MINUTES = PREDICTION_HORIZON + 5; // 20 minutes max
  const BREAKEVE_MOVE_PCT = 0.0010; // New: Move SL to entry if PnL reaches 0.10%

  // Weights for our Linear Model (Start with defaults, learn as we go)
  // Prediction = (wMomentum * Momentum) + (wObv * ObvSlope) + Bias
  const weights = {
    momentum: modelParams.momentumWeight * 1.2, // Multiplier adjusted to 1.2
    obv: 0.2, // Fixed OBV weight
    // Removed: vol: -0.1
  };
  
  // ADAPTIVE LEARNING SETTINGS (Normalized LMS)
  const BASE_LEARNING_RATE = 0.1; // Increased to help model adapt faster
  const EPSILON = 1e-6; // Safety factor to avoid division by zero
  
  const processedData = [...rawData];
  const signals: TradeSignal[] = [];
  const rejections: TradeRejection[] = []; // Store reasons for missed trades
  
  // Feature History for Training
  interface FeatureVector {
    slope: number;
    obvSlope: number;
    volChange: number;
  }
  const featureHistory: FeatureVector[] = Array.from({ length: processedData.length }, () => ({ slope: 0, obvSlope: 0, volChange: 0 }));

  // 1. Calculate Indicators & Predictions loop
  // Start loop early (5 mins) to build progressive predictions
  for (let i = 5; i < processedData.length; i++) {
    const current = processedData[i];
    const prev = processedData[i-1] || current;

    // --- Volume Moving Average ---
    if (i >= VOLUME_MA_WINDOW - 1) {
      let vSum = 0;
      for (let k = 0; k < VOLUME_MA_WINDOW; k++) {
        vSum += processedData[i - k].volume || 0;
      }
      processedData[i].volumeMA = vSum / VOLUME_MA_WINDOW;
    } else {
      processedData[i].volumeMA = current.volume;
    }

    // --- On-Balance Volume ---
    if (i === 0) {
      processedData[i].obv = 0;
    } else {
      let obvChange = 0;
      if (current.price > prev.price) {
        obvChange = current.volume || 0;
      } else if (current.price < prev.price) {
        obvChange = -(current.volume || 0);
      }
      processedData[i].obv = (prev.obv || 0) + obvChange;
    }

    // --- Volatility Metrics ---
    // Parkinson's Volatility (Intraday)
    if (i >= VOLATILITY_WINDOW) {
      let sumRangeSq = 0;
      for (let j = 0; j < VOLATILITY_WINDOW; j++) {
        const p = processedData[i - j];
        const h = p.high > 0 ? p.high : p.price;
        const l = p.low > 0 ? p.low : p.price;
        const lnHL = Math.log(h / l);
        sumRangeSq += (lnHL * lnHL);
      }
      const k = 1 / (4 * Math.log(2));
      processedData[i].parkinsonVolatility = Math.sqrt((k * sumRangeSq) / VOLATILITY_WINDOW) * 10000; 
      
      // Calculate Rolling Realized Volatility for Trading Thresholds
      const returns: number[] = [];
      for (let j = 0; j < 30; j++) { // Short 30m window for entry decisions
         const pCurr = processedData[i-j].price;
         const pPrev = processedData[i-j-1].price;
         returns.push(Math.log(pCurr/pPrev));
      }
      const meanRet = returns.reduce((a,b)=>a+b,0)/returns.length;
      const variance = returns.reduce((a,b)=>a+Math.pow(b-meanRet,2),0)/returns.length;
      processedData[i].realizedVolatility = Math.sqrt(variance) * 10000;
    } else {
      processedData[i].parkinsonVolatility = 0;
      processedData[i].realizedVolatility = 0;
    }

    // --- Online Learning & Prediction ---
    // Calculate effective lookback based on available data
    const effectiveLookback = Math.min(i, LOOKBACK_WINDOW);

    if (effectiveLookback >= 5) {
      // 1. Calculate Features
      
      // Feature A: Momentum Slope (Normalized & Smoothed)
      // Smoothing: Use SMA(5) of Current vs SMA(5) of Past to reduce single-candle noise
      let currentSma = current.price;
      let pastSma = processedData[i - effectiveLookback].price;

      // Calculate simple local averages if possible (only after first 15 mins)
      if (i >= SMA_SMOOTHING + 15) {
          let sumCurr = 0;
          for(let k=0; k<SMA_SMOOTHING; k++) sumCurr += processedData[i-k].price;
          currentSma = sumCurr / SMA_SMOOTHING;

          // Check bounds for past SMA
          const pastIndex = i - effectiveLookback;
          if (pastIndex >= SMA_SMOOTHING) {
             let sumPast = 0;
             for(let k=0; k<SMA_SMOOTHING; k++) sumPast += processedData[pastIndex-k].price;
             pastSma = sumPast / SMA_SMOOTHING;
          }
      }

      const slopeRaw = (currentSma - pastSma) / effectiveLookback;
      
      // Feature B: OBV Slope (Normalized by Volume MA)
      const obvStart = processedData[i - 10]?.obv || (current.obv || 0);
      const obvSlopeRaw = ((current.obv || 0) - obvStart) / 10;
      
      // CORRECTION: Ensure non-zero divisor for normalization to prevent NaN
      let volMA = current.volumeMA || 1;
      if (volMA <= 0) volMA = 1;
      
      // SCALING FIX: Removed * 100 to bring OBV magnitude inline with Price Slope (approx 0.1 - 2.0 range)
      const obvSlopeNorm = (obvSlopeRaw / volMA) || 0; // Fallback to 0 if NaN

      // Feature C: Volatility Change (REMOVED/ZEROED)
      const volChange = 0; // Feature removed to stabilize LMS

      // Store features for later training
      featureHistory[i] = { slope: slopeRaw || 0, obvSlope: obvSlopeNorm, volChange };

      // 2. Training Step (Normalized LMS Algorithm)
      // Check prediction made 15 minutes ago to see how we did
      const trainingIndex = i - PREDICTION_HORIZON;
      if (trainingIndex >= 5) {
         const pastFeatures = featureHistory[trainingIndex];
         const actualPriceChange = current.price - processedData[trainingIndex].price;
         
         // Reconstruct what our linear model predicted 
         const rawPred = (weights.momentum * pastFeatures.slope * PREDICTION_HORIZON) + 
                         (weights.obv * pastFeatures.obvSlope);
         
         const error = actualPriceChange - rawPred;

         // Adaptive Learning Rate (NLMS)
         const signalPower = (pastFeatures.slope * pastFeatures.slope) + 
                             (pastFeatures.obvSlope * pastFeatures.obvSlope);
                             
         const adaptiveAlpha = BASE_LEARNING_RATE / (EPSILON + signalPower);

         // Update Weights (Gradient Descent)
         weights.momentum += adaptiveAlpha * error * pastFeatures.slope;
         weights.obv += adaptiveAlpha * error * pastFeatures.obvSlope; 
         
         // Clamp Weights to prevent drift to zero
         if (weights.momentum < 0.1) weights.momentum = 0.1;
         if (weights.obv < 0.1) weights.obv = 0.1;
      }

      // 3. Make Prediction
      const modelPrediction = (weights.momentum * slopeRaw * PREDICTION_HORIZON) + 
                              (weights.obv * obvSlopeNorm);
                              
      // Add Regime Bias
      const regimeBias = modelParams.trendBias * 0.1;
      
      const rawFinalPrediction = current.price + modelPrediction + regimeBias;
      
      // Safety Clamp: Ensure prediction is within +/- 5% of current price to prevent chart blowout
      let clampedPrediction = rawFinalPrediction;
      
      // Additional NaN safeguard for assignment
      if (isNaN(clampedPrediction)) clampedPrediction = current.price; 

      const maxDeviation = current.price * 0.05;
      if (clampedPrediction > current.price + maxDeviation) clampedPrediction = current.price + maxDeviation;
      if (clampedPrediction < current.price - maxDeviation) clampedPrediction = current.price - maxDeviation;

      const finalPrediction = parseFloat(clampedPrediction.toFixed(2));
      processedData[i].predictionForFuture = finalPrediction;

      // VISUALIZATION MAPPING
      // Store this prediction in the FUTURE data point so we can graph "Predicted Price" vs "Actual Price"
      const futureIndex = i + PREDICTION_HORIZON;
      if (futureIndex < processedData.length) {
        processedData[futureIndex].predictedPrice = finalPrediction;
      }
    }
  }

  // 3. Dynamic Trading Engine with Risk Management
  
  // ADJUSTMENT: Aggressively lowered thresholds to initiate trades
  const BASE_ENTRY_THRESHOLD = 0.00015; // 0.015%
  const MIN_EFFECTIVE_THRESHOLD = 0.00001; // Virtually 0 to force trades
  
  const STOP_LOSS_PCT = 0.0015; // 0.15%
  const TAKE_PROFIT_PCT = 0.0030; // 0.30%
  
  // Track last rejection time to prevent spamming the logs
  let lastRejectionTime = 0;

  let currentPosition: 'NONE' | 'LONG' | 'SHORT' = 'NONE';
  let activeTrade: Partial<TradeSignal> | null = null;

  for (let i = LOOKBACK_WINDOW; i < processedData.length; i++) {
    const point = processedData[i];
    const prediction = point.predictionForFuture;
    const currentFeatures = featureHistory[i]; // Get features for trend alignment check
    
    // Can't trade without a prediction
    if (!prediction) continue;

    // Dynamic Threshold Calculation based on Intraday Realized Volatility
    // If market is choppy (high realized vol), we widen the required divergence to enter
    const currentRealizedVol = point.realizedVolatility || 8; 
    
    // Improved Volatility Multiplier: Floor of 0.6 to allow trades in quiet markets, Cap of 2.5
    // Normalizing around 10bps (0.10%) realized volatility
    const volMultiplier = Math.min(2.5, Math.max(0.6, currentRealizedVol / 10)); 

    const initialThreshold = BASE_ENTRY_THRESHOLD * modelParams.baseVolatilityThreshold * volMultiplier;
    const effectiveThreshold = Math.max(initialThreshold, MIN_EFFECTIVE_THRESHOLD);

    const divergence = (prediction - point.price) / point.price;
    // Don't open new trades in the last 10 minutes
    const isEndOfDay = i >= processedData.length - 10; 

    // --- Entry Logic ---
    if (currentPosition === 'NONE' && !isEndOfDay) {
      
      // Mean Reversion Filter: Don't buy if we just spiked up huge in last 5 mins
      const price5mAgo = processedData[i-5]?.price || point.price;
      const recentMove = (point.price - price5mAgo) / price5mAgo;
      
      // Only enter if recent move isn't already exhausted
      const isExhausted = Math.abs(recentMove) > 0.0025; // 0.25% move in 5 mins is a spike

      // --- ANALYSIS & REJECTION LOGGING ---
      // If we see a "Near Miss" (divergence > 0.005%), analyze why we didn't take it
      if (Math.abs(divergence) > MIN_EFFECTIVE_THRESHOLD) {
          let rejectionReason: TradeRejection['reason'] | null = null;
          let details = "";
          let thresholdRequired = effectiveThreshold;

          // Check Exhaustion
          if (isExhausted) {
              rejectionReason = 'EXHAUSTION';
              details = `Price spike of ${(recentMove * 100).toFixed(2)}% in 5m detected. Waiting for stability.`;
          } else {
             const momentumSlope = currentFeatures?.slope || 0;
             let thresholdLong = effectiveThreshold;
             let thresholdShort = effectiveThreshold;

             // Trend Bias
             const biasImpact = Math.max(-0.25, Math.min(0.25, modelParams.trendBias * 0.3));
             thresholdLong = thresholdLong * (1 - biasImpact);
             thresholdShort = thresholdShort * (1 + biasImpact);

             // 2. Intraday Trend Alignment (Tactical)
             // Softened Penalty: Allow model to fight the trend more easily.
             if (momentumSlope < -0.02) thresholdLong *= 1.15; // Updated to 1.15
             if (momentumSlope < -0.05) thresholdLong *= 1.1; 
             if (momentumSlope > 0.02) thresholdShort *= 1.15; // Updated to 1.15
             if (momentumSlope > 0.05) thresholdShort *= 1.1; 
             
             // Check if we failed the "Trend Fighting" filter
             if (divergence > 0 && divergence < thresholdLong && divergence > initialThreshold) {
                  rejectionReason = 'TREND_FILTER';
                  details = `Long signal (+${(divergence*100).toFixed(3)}%) too weak to fight negative momentum (${momentumSlope.toFixed(4)}). Req: ${(thresholdLong*100).toFixed(3)}%`;
                  thresholdRequired = thresholdLong;
             } else if (divergence < 0 && Math.abs(divergence) < thresholdShort && Math.abs(divergence) > initialThreshold) {
                  rejectionReason = 'TREND_FILTER';
                  details = `Short signal (${(divergence*100).toFixed(3)}%) too weak to fight positive momentum (${momentumSlope.toFixed(4)}). Req: ${(thresholdShort*100).toFixed(3)}%`;
                  thresholdRequired = thresholdShort;
             } 
             // Check if we failed just because of Volatility Clamping / Base Threshold
             else if (Math.abs(divergence) < effectiveThreshold) {
                  rejectionReason = 'LOW_CONVICTION';
                  details = `Divergence ${(divergence*100).toFixed(3)}% below dynamic threshold ${(effectiveThreshold*100).toFixed(3)}% (Vol Mult: ${volMultiplier.toFixed(1)}x)`;
             }
          }

          if (rejectionReason) {
              // Rate limit logging to avoid spam, unless it's a new type of rejection or significant time passed (15 mins)
              if (i - lastRejectionTime > 15 || rejectionReason === 'TREND_FILTER' || rejectionReason === 'EXHAUSTION') {
                   rejections.push({
                       id: `REJ-${i}`,
                       time: point.time,
                       timestamp: point.timestamp,
                       reason: rejectionReason,
                       details,
                       divergence,
                       thresholdRequired
                   });
                   lastRejectionTime = i;
              }
          }
      }

      if (!isExhausted) {
        const momentumSlope = currentFeatures?.slope || 0;
        
        let thresholdLong = effectiveThreshold;
        let thresholdShort = effectiveThreshold;

        // 1. Daily Regime Bias (Strategic)
        const biasImpact = Math.max(-0.25, Math.min(0.25, modelParams.trendBias * 0.3));
        thresholdLong = thresholdLong * (1 - biasImpact);
        thresholdShort = thresholdShort * (1 + biasImpact);

        // 2. Intraday Trend Alignment (Tactical)
        // Softened Penalty: Allow model to fight the trend more easily.
        if (momentumSlope < -0.02) thresholdLong *= 1.15; // Updated to 1.15
        if (momentumSlope < -0.05) thresholdLong *= 1.1; 

        if (momentumSlope > 0.02) thresholdShort *= 1.15; // Updated to 1.15
        if (momentumSlope > 0.05) thresholdShort *= 1.1; 

        if (divergence > thresholdLong) {
          // OPEN LONG
          currentPosition = 'LONG';
          activeTrade = {
            id: `TRD-${i}`,
            time: point.time,
            timestamp: point.timestamp,
            type: SignalType.BUY,
            priceAtSignal: point.price,
            predictedPrice: prediction,
            stopLossPrice: parseFloat((point.price * (1 - STOP_LOSS_PCT)).toFixed(2)),
            takeProfitPrice: parseFloat((point.price * (1 + TAKE_PROFIT_PCT)).toFixed(2)),
            status: 'OPEN'
          };
        } else if (divergence < -thresholdShort) {
          // OPEN SHORT
          currentPosition = 'SHORT';
          activeTrade = {
            id: `TRD-${i}`,
            time: point.time,
            timestamp: point.timestamp,
            type: SignalType.SELL,
            priceAtSignal: point.price,
            predictedPrice: prediction,
            stopLossPrice: parseFloat((point.price * (1 + STOP_LOSS_PCT)).toFixed(2)),
            takeProfitPrice: parseFloat((point.price * (1 - TAKE_PROFIT_PCT)).toFixed(2)),
            status: 'OPEN'
          };
        }
      }
    }

    // --- Exit Logic ---
    else if (currentPosition !== 'NONE' && activeTrade) {
      let shouldExit = false;
      let exitReason: TradeSignal['exitReason'] = undefined;

      // 0. Breakeven Stop Loss Check (New)
      if (activeTrade.status === 'OPEN' && activeTrade.priceAtSignal) {
          const profitPct = currentPosition === 'LONG' 
              ? (point.price - activeTrade.priceAtSignal) / activeTrade.priceAtSignal 
              : (activeTrade.priceAtSignal - point.price) / activeTrade.priceAtSignal;

          if (profitPct >= BREAKEVE_MOVE_PCT) {
              // Move SL to entry price only if it's currently worse than entry
              if (currentPosition === 'LONG' && activeTrade.stopLossPrice! < activeTrade.priceAtSignal) {
                  activeTrade.stopLossPrice = activeTrade.priceAtSignal; 
              } else if (currentPosition === 'SHORT' && activeTrade.stopLossPrice! > activeTrade.priceAtSignal) {
                  activeTrade.stopLossPrice = activeTrade.priceAtSignal;
              }
          }
      }

      // 1. Risk Management Checks (Priority)
      if (currentPosition === 'LONG') {
        if (point.price <= (activeTrade.stopLossPrice || 0)) {
           shouldExit = true; 
           exitReason = 'STOP_LOSS';
        } else if (point.price >= (activeTrade.takeProfitPrice || 0)) {
           shouldExit = true;
           exitReason = 'TAKE_PROFIT';
        }
      } else if (currentPosition === 'SHORT') {
        if (point.price >= (activeTrade.stopLossPrice || 0)) {
           shouldExit = true;
           exitReason = 'STOP_LOSS';
        } else if (point.price <= (activeTrade.takeProfitPrice || 0)) {
           shouldExit = true;
           exitReason = 'TAKE_PROFIT';
        }
      }

      // 2. Convergence/Reversal Checks (Strategy Exit)
      if (!shouldExit) {
        // Exit if prediction is no longer valid (converged)
        if (Math.abs(divergence) < 0.0002) {
            shouldExit = true;
            exitReason = 'CONVERGENCE';
        }
        // Exit if signal flips
        if (currentPosition === 'LONG' && divergence < -0.0002) {
            shouldExit = true;
            exitReason = 'REVERSAL';
        }
        if (currentPosition === 'SHORT' && divergence > 0.0002) {
            shouldExit = true;
            exitReason = 'REVERSAL';
        }
      }

      // 3. Time-Out Check (Strategy Exit)
      // If the trade hasn't worked out within the prediction horizon + 5 mins, close it.
      if (!shouldExit && activeTrade.timestamp) {
          const durationMinutes = Math.round((point.timestamp - activeTrade.timestamp) / 60000);
          if (durationMinutes >= MAX_TRADE_DURATION_MINUTES) {
              shouldExit = true;
              exitReason = 'TIME_OUT';
          }
      }

      // 4. End of Day Force Close
      if (isEndOfDay) {
          shouldExit = true;
          exitReason = 'EOD';
      }

      if (shouldExit) {
        // Calculate PnL
        let pnl = 0;
        if (currentPosition === 'LONG') {
          pnl = point.price - (activeTrade.priceAtSignal || 0);
        } else {
          pnl = (activeTrade.priceAtSignal || 0) - point.price;
        }

        const completedSignal: TradeSignal = {
          ...activeTrade as TradeSignal,
          exitTime: point.time,
          exitPrice: point.price,
          actualResultPrice: point.price, 
          profit: parseFloat(pnl.toFixed(2)),
          status: 'CLOSED',
          exitReason,
          durationMinutes: Math.round((point.timestamp - (activeTrade.timestamp || 0)) / 60000)
        };

        signals.push(completedSignal);
        currentPosition = 'NONE';
        activeTrade = null;
      }
    }
  }

  // 4. Analyze Results
  const totalGain = signals.reduce((acc, curr) => acc + (curr.profit || 0), 0);
  const winningTrades = signals.filter(s => (s.profit || 0) > 0).length;
  const totalTrades = signals.length;
  
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnL = 0;
  
  signals.forEach(s => {
    runningPnL += s.profit || 0;
    if (runningPnL > peak) peak = runningPnL;
    const drawdown = peak - runningPnL;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  const analysis: MarketAnalysis = {
    totalGain: parseFloat(totalGain.toFixed(2)),
    totalTrades,
    accuracy: totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1)) : 0,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    winRate: totalTrades > 0 ? winningTrades / totalTrades : 0
  };

  return { processedData, signals, rejections, analysis };
};
