
import { DataPoint } from '../types';

type PriceUpdateCallback = (data: DataPoint) => void;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private symbol: string;
  private callback: PriceUpdateCallback | null = null;
  private mockInterval: any = null;
  private lastPrice: number = 590.00;
  private lastTimestamp: number = Date.now();

  constructor(url: string = '', symbol: string = 'SPY') {
    // If no URL provided, we will fall back to mock mode
    this.url = url; 
    this.symbol = symbol;
  }

  public connect(callback: PriceUpdateCallback) {
    this.callback = callback;
    
    if (this.url) {
      this.connectReal();
    } else {
      this.connectMock();
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
  }

  private connectReal() {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket Connected');
        // Example subscription for Finnhub structure
        this.socket?.send(JSON.stringify({ type: 'subscribe', symbol: this.symbol }));
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Assuming Finnhub structure: { data: [{ p: price, t: timestamp, v: volume }] }
          if (message.type === 'trade' && message.data) {
             message.data.forEach((trade: any) => {
                const point: DataPoint = {
                  time: new Date(trade.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  timestamp: trade.t,
                  price: trade.p,
                  open: trade.p, // Real-time tick approximations
                  high: trade.p,
                  low: trade.p,
                  volume: trade.v
                };
                if (this.callback) this.callback(point);
             });
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket Error', error);
      };

    } catch (e) {
      console.error('Failed to create WebSocket', e);
    }
  }

  private connectMock() {
    console.log('Using Mock WebSocket for Demo');
    this.lastTimestamp = Date.now();
    
    // Simulate a tick every 1 second
    this.mockInterval = setInterval(() => {
      const now = Date.now();
      
      // Random walk simulation
      const change = (Math.random() - 0.5) * 0.15;
      this.lastPrice += change;
      
      // Add occasional volume spike
      const volume = Math.floor(Math.random() * 5000) + 100;

      const point: DataPoint = {
        time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: now,
        price: parseFloat(this.lastPrice.toFixed(2)),
        open: parseFloat(this.lastPrice.toFixed(2)),
        high: parseFloat((this.lastPrice + Math.abs(change)).toFixed(2)),
        low: parseFloat((this.lastPrice - Math.abs(change)).toFixed(2)),
        volume: volume
      };

      if (this.callback) {
        this.callback(point);
      }

    }, 1000);
  }
}

// Singleton instance helper
let wsInstance: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!wsInstance) {
    // Check for env variable, otherwise blank (triggers mock)
    const apiKey = ""; // process.env.REACT_APP_FINNHUB_KEY
    const url = apiKey ? `wss://ws.finnhub.io?token=${apiKey}` : ''; 
    wsInstance = new WebSocketService(url, 'SPY');
  }
  return wsInstance;
};
