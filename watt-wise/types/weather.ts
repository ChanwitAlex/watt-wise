/** พยากรณ์อากาศหนึ่งชั่วโมงของหนึ่งจุด (เวลาท้องถิ่นไทย) */
export interface ForecastHour {
  timestamp: string; // YYYY-MM-DD HH:MM
  date: string;
  hour: number;
  tempC: number;
  humidityPercent: number;
  rainMm: number;
  windKmh: number;
  gustKmh: number;
}

export interface WeatherLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}
