import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';

const CommunityScreen = () => {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.box, animatedStyle]} />
      <View style={styles.sliders}>
        <Text>x: {x.value.toFixed(0)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={-200}
          maximumValue={200}
          onValueChange={value => (x.value = value)}
        />
        <Text>y: {y.value.toFixed(0)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={-200}
          maximumValue={200}
          onValueChange={value => (y.value = value)}
        />
        <Text>rotate: {rotate.value.toFixed(0)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={-180}
          maximumValue={180}
          onValueChange={value => (rotate.value = value)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 200,
    height: 200,
    borderRadius: 20,
    borderWidth: 5,
    borderColor: '#ff0088',
    borderStyle: 'dotted',
  },
  sliders: {
    marginTop: 50,
    width: 300,
  },
  slider: {
    width: 300,
    height: 40,
  },
});

export default CommunityScreen;