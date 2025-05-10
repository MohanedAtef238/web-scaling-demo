const express = require('express');
const { createClient } = require('redis');
const axios = require('axios');

const serverPort = 8080;
const serverHost = '0.0.0.0';
const serverNumber = '1';
const weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';
const redisUrl = process.env.REDIS_URL

const app = express();
const redisClient = createClient({ url: redisUrl });

app.set('view engine', 'pug');

app.get('/', async (req, res) => {
  const cacheKey = `server${serverNumber}:weatherData`;
  const cachedWeatherData = await redisClient.get(cacheKey);

  if (cachedWeatherData) {
    console.log('Serving weather from cache');
    const weatherData = JSON.parse(cachedWeatherData);
    const temperature = weatherData.current.temperature_2m;

    res.render('index', { serverNumber, temperature });
    return;
  }

  console.log('Serving weather from API');

  const response = await axios.get(weatherApiUrl, {
    params: {
      latitude: 30.0626,
      longitude: 31.2497,
      current: 'temperature_2m',
      timezone: 'Africa/Cairo',
    },
  });

  const weatherData = response.data;
  const temperature = weatherData.current.temperature_2m;

  await redisClient.setEx(cacheKey, 600, JSON.stringify(weatherData));

  res.render('index', { serverNumber, temperature });
});

async function main() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    const server = app.listen(serverPort, serverHost, () => {
      console.log(`Listening at http://${serverHost}:${serverPort}`);
    });

    const shutdownHandler = async () => {
      console.log('Shutting down gracefully...');
      await redisClient.disconnect();
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
