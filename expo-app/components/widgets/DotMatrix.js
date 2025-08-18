import React from 'react';
import { View, StyleSheet } from 'react-native';

const charMap = {
  'A': [126, 17, 17, 126], 'B': [127, 73, 73, 54], 'C': [62, 65, 65, 34],
  'D': [127, 65, 65, 62], 'E': [127, 73, 73, 65], 'F': [127, 9, 9, 1],
  'G': [62, 65, 73, 58], 'H': [127, 8, 8, 127], 'I': [65, 127, 65],
  'J': [2, 1, 1, 126], 'K': [127, 8, 20, 99], 'L': [127, 64, 64],
  'M': [127, 2, 4, 2, 127], 'N': [127, 4, 8, 16, 127],
  'O': [62, 65, 65, 62], 'P': [127, 9, 9, 6], 'Q': [62, 65, 81, 94],
  'R': [127, 9, 25, 102], 'S': [102, 73, 73, 49], 'T': [1, 1, 127, 1, 1],
  'U': [63, 64, 64, 63], 'V': [31, 32, 64, 32, 31],
  'W': [63, 64, 32, 64, 63], 'X': [99, 20, 8, 20, 99],
  'Y': [7, 8, 112, 8, 7], 'Z': [97, 81, 73, 67],
  '0': [62, 65, 65, 62], '1': [66, 127, 64], '2': [98, 81, 73, 70],
  '3': [34, 65, 73, 54], '4': [60, 36, 34, 127], '5': [119, 73, 73, 57],
  '6': [62, 73, 73, 50], '7': [1, 1, 126], '8': [54, 73, 73, 54],
  '9': [38, 73, 73, 62], ' ': [0, 0, 0, 0],
  '.': [96], ':': [48, 48], '-': [8, 8, 8, 8],
  '°': [7, 5, 7, 0],
};

const DotMatrix = ({ rows = 5, cols = 80, text = '' }) => {
  const getCharData = (char) => {
    return charMap[char.toUpperCase()] || charMap[' '];
  };

  const isDotActive = (row, col) => {
    let charIndex = Math.floor(col / (5 + 1)); // 5 is char width, 1 is spacing
    if (charIndex >= text.length) return false;

    let char = text[charIndex];
    let charData = getCharData(char);
    let charCol = col % 6;

    if (charCol >= 5) return false; // spacing

    return (charData[charCol] >> row) & 1;
  };

  const grid = [];
  for (let r = 0; r < rows; r++) {
    const rowDots = [];
    for (let c = 0; c < cols; c++) {
      rowDots.push(
        <View
          key={`dot-${r}-${c}`}
          style={[styles.dot, isDotActive(r, c) ? styles.dotActive : {}]}
        />
      );
    }
    grid.push(
      <View key={`row-${r}`} style={styles.row}>
        {rowDots}
      </View>
    );
  }

  return <View style={styles.container}>{grid}</View>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    padding: 10,
  },
  row: {
    flexDirection: 'row',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    margin: 1,
  },
  dotActive: {
    backgroundColor: '#ff0088',
  },
});

export default DotMatrix;
