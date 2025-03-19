import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const router = Router();
const dbPath = path.join(__dirname, "../../../../", "server", "db", "db.json");

console.log(dbPath)


// **🔹 POST Route: Get Weather Data & Save City**
// /api/weather/
router.post('/', async (req: Request, res: Response) => {
  try {
    const { city } = req.body;
    if (!city) {
      return res.status(400).json({ error: "City name is required!" });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key is missing in .env file!" });
    }
    const geocodeUrl =  `http://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);

    const geodata = await geocodeResponse.json();
    const {lat,lon} = geodata[0];
    
    // console.log(geodata);

  
    // console.log(lat);
  
    // console.log(lon);
    // const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const response = await fetch(forecastUrl);

    if (!response.ok) {
      return res.status(404).json({ error: "City not found!" });
    }

    const weatherData = await response.json();
    // console.log(weatherData);
    // const { city, date, icon, iconDescription, tempF, windSpeed, humidity } = currentWeather;

    let history = [];
    try {
      const data = await fs.readFile(dbPath, 'utf-8');
      // const data = '';
      if (data.trim()) {
        history = JSON.parse(data);
      }
    } catch (error) {
      history = [];
    }
    
    const wetherEntries = weatherData.list.reduce((acc: any,forecast:any , index:number) => {
      // const date = forecast.dt_txt.split(" ")[0];
      const time = forecast.dt_txt.split(" ")[1];

      const newEntry = { 
        city: weatherData.city.name, 
        date: forecast.dt_txt, 
        icon: forecast.weather[0].icon, 
        iconDescription: forecast.weather[0].description,
        tempF: kelvinToFahrenheit(weatherData.list[0].main.temp), 
        windSpeed: forecast.wind.speed,
        humidity: forecast.main.humidity,
        weatherData
      }

      if(index === 0) {
        acc.push(newEntry)
      }

      if (time === "12:00:00") {
          acc.push(newEntry)
      }

      return acc
    }, [])

    history.push({name: weatherData.city.name, id: weatherData.city.id});
    
    await fs.writeFile(dbPath, JSON.stringify(history, null, 2));

    return res.json(wetherEntries); // ✅ Ensure function **always returns a response**
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return res.status(500).json({ error: "Internal Server Error" }); // ✅ Add return
  }
});

// Math.ceil()
function kelvinToFahrenheit(kelvin: number) {
  return Math.ceil((kelvin - 273.15) * 9/5 + 32);
}


// **🔹 GET Route: Retrieve Search History**
// api/weather/history
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    // const data = '';
    if (!data.trim()) {
      return res.json([]); // ✅ Return an empty array if no data
    }

    const history = JSON.parse(data);
    return res.json(history); // ✅ Ensure response is always returned
  } catch (error) {
    console.error("Error reading history:", error);
    return res.status(500).json({ error: "Failed to load search history" }); // ✅ Return an error response
  }
});


// **🔹 DELETE Route: Remove City from Search History**
// /api/weather/history/:id
router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const data = await fs.readFile(dbPath, 'utf-8');
    let history = JSON.parse(data);

    const updatedHistory = history.filter((entry: any) => entry.id !== parsedId);

    if (history.length === updatedHistory.length) {
      return res.status(404).json({ error: "City not found in history" }); // ✅ If no entry was removed, return 404
    }

    await fs.writeFile(dbPath, JSON.stringify(updatedHistory, null, 2));
    return res.json({ message: "City deleted successfully!" });
  } catch (error) {
    console.error("Error deleting city:", error);
    return res.status(500).json({ error: "Internal Server Error" }); // ✅ Ensure error response is returned
  }
});


export default router;