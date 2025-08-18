import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import CommunityScreen from '../screens/CommunityScreen';
import MapScreen from '../screens/MapScreen';
import ProjectsScreen from '../screens/ProjectsScreen';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
