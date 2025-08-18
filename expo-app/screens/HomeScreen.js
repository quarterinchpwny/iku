import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ThemeSwitcher from '../components/ThemeSwitcher';
import WeatherWidget from '../components/widgets/WeatherWidget';

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Home Screen</Text>
      <ThemeSwitcher />
      <WeatherWidget />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
