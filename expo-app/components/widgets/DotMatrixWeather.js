import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import DotMatrix from './DotMatrix';

const DotMatrixWeather = () => {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  useEffect(() => {
    if (location) {
      fetchWeather();
    }
  }, [location]);

  const fetchWeather = async () => {
    if (!location) return;
    try {
      const { latitude, longitude } = location.coords;
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const data = await response.json();
      setWeather(data.current_weather);
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      setErrorMsg('Failed to fetch weather data');
    }
  };

  let text = 'Loading...';
  if (errorMsg) {
    text = errorMsg;
  } else if (weather) {
    text = `Temp: ${weather.temperature} C  Wind: ${weather.windspeed} km/h`;
  }

  return (
    <View style={styles.container}>
      <DotMatrix text={text} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
});

export default DotMatrixWeather;
