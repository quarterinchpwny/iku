import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('iku.db');

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [pathCoords, setPathCoords] = useState([]);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [motionPermissionGranted, setMotionPermissionGranted] = useState(false);
  const [historyRoutes, setHistoryRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const mapRef = useRef(null);
  const watchId = useRef(null);
  let lastPoint = useRef(null);
  let routeId = useRef(null);

  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp REAL);'
      );
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS points (id INTEGER PRIMARY KEY AUTOINCREMENT, routeId INTEGER, lat REAL, lon REAL, timestamp REAL);'
      );
    });
    loadHistory();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  const requestMotionPermission = async () => {
    const { status } = await DeviceMotion.requestPermissionsAsync();
    if (status === 'granted') {
        setMotionPermissionGranted(true)
        DeviceMotion.addListener(({rotation}) => {
            if(rotation){
                setHeading(rotation.alpha)
            }
        })
    }
  };

  const loadHistory = () => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM routes ORDER BY timestamp DESC', [], (_, { rows }) => {
        setHistoryRoutes(rows._array);
      });
    });
  };

  const startTracking = async () => {
    setIsTracking(true);
    setPathCoords([]);
    setDistance(0);
    setSpeed(0);
    lastPoint.current = null;

    db.transaction(tx => {
        tx.executeSql('INSERT INTO routes (timestamp) VALUES (?)', [Date.now()], (_, { insertId }) => {
            routeId.current = insertId;
        })
    })

    watchId.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (newLocation) => {
        setLocation(newLocation);
        const { latitude, longitude } = newLocation.coords;
        const newPoint = { latitude, longitude };

        setPathCoords(prevCoords => [...prevCoords, newPoint]);

        if (lastPoint.current) {
          const newDistance = distance + haversine(lastPoint.current, newPoint);
          setDistance(newDistance);
          const dt = (newLocation.timestamp - lastPoint.current.timestamp) / 1000;
          if (dt > 0) {
            const newSpeed = (haversine(lastPoint.current, newPoint) / dt) * 3.6;
            setSpeed(newSpeed);
          }
        }
        lastPoint.current = { ...newPoint, timestamp: newLocation.timestamp };

        db.transaction(tx => {
            tx.executeSql('INSERT INTO points (routeId, lat, lon, timestamp) VALUES (?, ?, ?, ?)', [routeId.current, latitude, longitude, newLocation.timestamp])
        })
      }
    );
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (watchId.current) {
      watchId.current.remove();
    }
    loadHistory();
  };

  const loadRoute = (id) => {
      setSelectedRouteId(id)
      db.transaction(tx => {
          tx.executeSql('SELECT * FROM points WHERE routeId = ? ORDER BY timestamp ASC', [id], (_, {rows}) => {
              const points = rows._array.map(p => ({latitude: p.lat, longitude: p.lon}))
              setPathCoords(points)
              if(mapRef.current && points.length > 0){
                  mapRef.current.fitToCoordinates(points, {
                      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                      animated: true,
                  })
              }
          })
      })
  }

  const haversine = (p1, p2) => {
    const R = 6371e3;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
        >
          <Polyline coordinates={pathCoords} strokeColor="#000" strokeWidth={6} />
        </MapView>
      )}
      <View style={styles.overlay}>
        <Text>Speed: {speed.toFixed(2)} km/h</Text>
        <Text>Distance: {distance.toFixed(2)} km</Text>
        <Text>Heading: {heading.toFixed(2)}</Text>
        {!isTracking ? (
          <Button title="Start Tracking" onPress={startTracking} />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} />
        )}
        <Button title="Request Motion Permission" onPress={requestMotionPermission} />
        {historyRoutes.map(r => <Button key={r.id} title={new Date(r.timestamp).toLocaleString()} onPress={() => loadRoute(r.id)} />)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    borderRadius: 5,
  },
});

export default MapScreen;