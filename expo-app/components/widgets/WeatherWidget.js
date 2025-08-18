import React from 'react';
import { useTheme } from '../../theme/ThemeContext';
import DotMatrixWeather from './DotMatrixWeather';
import ClassicWeather from './ClassicWeather';

const WeatherWidget = () => {
  const { theme } = useTheme();

  if (theme === 'dot-matrix') {
    return <DotMatrixWeather />;
  } else {
    return <ClassicWeather />;
  }
};

export default WeatherWidget;
