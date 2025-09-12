<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import DotMatrix from './DotMatrix.vue';

const weatherData = ref(null);
const location = ref(null);
const isLoading = ref(true);
const error = ref(null);
const lastUpdated = ref(null);
const currentDisplay = ref(0); // For cycling through different displays

const refreshInterval = ref(null);
const REFRESH_RATE = 300000; // 5 minutes

const displayModes = [
  'temperature',
  'humidity', 
  'wind',
  'condition',
  'location'
];

const weatherConditions = {
  0: 'CLEAR',
  1: 'MOSTLY CLEAR', 
  2: 'PARTLY CLOUDY',
  3: 'OVERCAST',
  45: 'FOGGY',
  48: 'RIME FOG',
  51: 'LIGHT DRIZZLE',
  53: 'DRIZZLE',
  55: 'HEAVY DRIZZLE',
  61: 'LIGHT RAIN',
  63: 'RAIN',
  65: 'HEAVY RAIN',
  71: 'LIGHT SNOW',
  73: 'SNOW',
  75: 'HEAVY SNOW',
  95: 'THUNDERSTORM'
};

const displayText = computed(() => {
  if (isLoading.value) return 'LOADING WEATHER...';
  if (error.value) return `ERROR: ${error.value}`;
  if (!weatherData.value) return 'NO DATA';

  const mode = displayModes[currentDisplay.value];
  const weather = weatherData.value.current;
  
  switch (mode) {
    case 'temperature':
      return `TEMP: ${Math.round(weather.temperature_2m)}°C\nFEELS: ${Math.round(weather.apparent_temperature)}°C`;
    
    case 'humidity':
      return `HUMIDITY: ${weather.relative_humidity_2m}%\nDEW POINT: ${Math.round(weather.dew_point_2m)}°C`;
    
    case 'wind':
      return `WIND: ${Math.round(weather.wind_speed_10m)} KM/H\nDIRECTION: ${weather.wind_direction_10m}°`;
    
    case 'condition':
      const condition = weatherConditions[weather.weather_code] || 'UNKNOWN';
      return `CONDITION:\n${condition}\nRAIN: ${weather.precipitation}MM`;
    
    case 'location':
      return location.value ? 
        `LAT: ${location.value.latitude.toFixed(2)}\nLON: ${location.value.longitude.toFixed(2)}` :
        'LOCATION\nUNKNOWN';
    
    default:
      return 'WEATHER DATA';
  }
});

async function fetchWeatherData() {
  try {
    isLoading.value = true;
    error.value = null;

    // Get current position
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
    
    const { latitude, longitude } = coordinates.coords;
    location.value = { latitude, longitude };

    // Fetch comprehensive weather data
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${latitude}&longitude=${longitude}&` +
      `current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
      `dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&` +
      `timezone=auto`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    weatherData.value = data;
    lastUpdated.value = new Date();
    
    console.log('Weather data updated:', data);
    
  } catch (err) {
    console.error('Failed to fetch weather data:', err);
    error.value = err.message || 'FETCH FAILED';
  } finally {
    isLoading.value = false;
  }
}

function cycleDisplay() {
  currentDisplay.value = (currentDisplay.value + 1) % displayModes.length;
}

function startAutoRefresh() {
  // Refresh weather data every 5 minutes
  refreshInterval.value = setInterval(fetchWeatherData, REFRESH_RATE);
  
  // Cycle display every 8 seconds
  setInterval(cycleDisplay, 8000);
}

function stopAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
}

async function refreshWeather() {
  await fetchWeatherData();
}

onMounted(async () => {
  await fetchWeatherData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});

defineExpose({
  refreshWeather,
  cycleDisplay
});
</script>

<template>
  <div class="weather-display">
    <!-- Enhanced DotMatrix with dynamic colors and effects -->
    <DotMatrix 
      :text="displayText" 
      :enable-pulse="isLoading"
      :color="error ? '#ff4444' : isLoading ? '#ffaa00' : '#ff7300ff'"
    />
    
    <!-- Status indicator -->
    <div class="status-bar mt-4 text-sm text-gray-600 flex justify-between items-center">
      <span v-if="lastUpdated" class="text-xs">
        Updated: {{ lastUpdated.toLocaleTimeString() }}
      </span>
      
      <div class="flex gap-2">
        <button 
          @click="refreshWeather" 
          :disabled="isLoading"
          class="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50"
        >
          {{ isLoading ? 'Loading...' : 'Refresh' }}
        </button>
        
        <button 
          @click="cycleDisplay"
          class="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        >
          Next ({{ displayModes[currentDisplay].toUpperCase() }})
        </button>
      </div>
    </div>
    
    <!-- Display mode indicator -->
    <div class="mode-indicators mt-2 flex gap-1 justify-center">
      <div 
        v-for="(mode, index) in displayModes" 
        :key="mode"
        :class="[
          'w-2 h-2 rounded-full transition-colors',
          index === currentDisplay ? 'bg-orange-500' : 'bg-gray-300'
        ]"
        :title="mode.toUpperCase()"
      />
    </div>
  </div>
</template>

<style scoped>
.weather-display {
  max-width: 100%;
  margin: 0 auto;
}

.status-bar button:disabled {
  cursor: not-allowed;
}

.mode-indicators {
  user-select: none;
}
</style>
