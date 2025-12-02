
import { GoogleGenAI } from "@google/genai";
import { MarketAnalysis, TradeSignal } from '../types';

export const getGeminiAnalysis = async (
  marketStats: MarketAnalysis, 
  recentSignals: TradeSignal[]
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return "Simulation Mode: API Key not found. Please provide an API Key to generate the AI analyst report.";
    }

    const ai = new GoogleGenAI({ apiKey });

    // Summarize signals for the prompt to save tokens
    const signalSummary = recentSignals.slice(0, 15).map(s => 
      `${s.time} (${s.type}): Entry ${s.priceAtSignal} -> Exit ${s.exitPrice} (${s.durationMinutes}m duration). Profit: ${s.profit}`
    ).join('\n');

    const prompt = `
      You are a senior quantitative financial analyst reviewing a proprietary high-frequency trading algorithm's performance on SPY for the last trading session.
      
      Strategy: Dynamic Divergence.
      - Enters when the 15-minute prediction diverges significantly from current price.
      - Exits immediately when price "overlaps" or converges with the prediction, or upon reversal.
      - Variable trade duration.
      
      Performance Data:
      - Total Net Profit: $${marketStats.totalGain} (per share basis)
      - Total Trades: ${marketStats.totalTrades}
      - Win Rate: ${marketStats.accuracy}%
      - Max Drawdown: $${marketStats.maxDrawdown}

      Sample of Recent Trades:
      ${signalSummary}
      ... (and more)

      Task:
      Provide a concise, professional executive summary.
      1. Analyze the profitability and stability.
      2. Comment on the efficiency of the dynamic exit strategy (short vs long duration trades).
      3. Recommend one improvement (e.g., trailing stops, volatility scaling).
      
      Keep the tone professional, objective, and data-driven. Limit to 150 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis could not be generated.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI Analyst service. Please check your network or API quota.";
  }
};
