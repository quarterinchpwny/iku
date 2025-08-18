import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabNavigator from './navigation/BottomTabNavigator';
import { ThemeProvider } from './theme/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </ThemeProvider>
  );
}