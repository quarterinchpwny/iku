import React from 'react';
import { View, Button } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  const switchTheme = () => {
    if (theme === 'dot-matrix') {
      setTheme('classic');
    } else {
      setTheme('dot-matrix');
    }
  };

  return (
    <View>
      <Button title="Switch Theme" onPress={switchTheme} />
    </View>
  );
};

export default ThemeSwitcher;
