import { Client, Dispatcher } from "undici";
import { example, Tool } from "../../tools";
import { ToolLayer } from "../../type";

interface WeatherInput {
  city: string;
  unit: "F" | "C";
}

interface WeatherOutput {
  temperature: string;
  unit: "F" | "C";
  wind: string;
}

@example(`
    interface Example {
      /**
       * City to query the weather for
       */
      city: string

      /**
       * Unit in which the temperature should be printed, possible options are "F" or "C"
       */
      unit: string
    }
  `)
export class WeatherTool extends Tool<WeatherInput, WeatherOutput> {
  private client: Client | Dispatcher;

  private URL = "https://api.openweathermap.org";

  constructor(apiKey: string) {
    super("get_weather", "Get's weather for city");
    this.client = new Client(this.URL).compose((dispatch) => {
      return (options, handler) => {
        options.headers = {
          ...options.headers,
        };
        options.query = {
          ...options.query,
          appid: apiKey,
        };

        return dispatch(options, handler);
      };
    });
  }

  async getCords(city: string) {
    return this.client.request({
      path: "/geo/1.0/direct",
      method: "GET",
      query: { q: city },
    });
  }

  async getWeather(lat: number, lon: number, unit: string) {
    const units = unit === "F" ? "imperial" : "metric";
    return this.client.request({
      path: "/data/2.5/weather",
      method: "GET",
      query: {
        lat,
        lon,
        units,
      },
    });
  }

  async handler(params: WeatherInput): Promise<WeatherOutput> {
    try {
      const coordsRequest = await this.getCords(params.city);
      const coords = (await coordsRequest.body.json()) as {
        name: string;
        lat: number;
        lon: number;
      }[];

      const firstCity = coords.at(0);
      if (!firstCity) {
        throw new Error("Failed to get coordinates for the provided city");
      }

      const weatherRequest = await this.getWeather(
        firstCity.lat,
        firstCity.lon,
        params.unit
      );

      const response = (await weatherRequest.body.json()) as any;

      const output: WeatherOutput = {
        temperature: response.main.temp,
        unit: params.unit,
        wind: response.wind.speed,
      };
      return output;
    } catch (error) {
      throw error;
    }
  }
}

export class Weather implements ToolLayer {
  id = "get_weather";
  type = "tool" as const;

  tool: Tool<any, any>;
  constructor(envKey: string) {
    this.tool = new WeatherTool(process.env[envKey] ?? "");
  }
}
