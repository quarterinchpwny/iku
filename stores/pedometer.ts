import { defineStore } from 'pinia';
import { CapacitorPedometer as Pedometer } from '@capgo/capacitor-pedometer';
import { Device } from '@capacitor/device';

export const usePedometerStore = defineStore('pedometer', () => {
  const steps = ref(0);
  const isSupported = ref(false);
  const isTracking = ref(false);
  const error = ref(null);
  let measurementListener = null;

  async function checkSupport() {
    try {
      const info = await Device.getInfo();
      if (info.platform === 'web') {
        console.warn('Pedometer not supported on web');
        isSupported.value = false;
        return false;
      }

      const result = await Pedometer.isAvailable();
      isSupported.value = result.stepCounting;
      return result.stepCounting;
    } catch (e) {
      console.error('Error checking pedometer support:', e);
      isSupported.value = false;
      return false;
    }
  }

  async function startTracking() {
    error.value = null;
    try {
      const info = await Device.getInfo();
      if (info.platform === 'web') {
        throw new Error('Pedometer is not available on web platform');
      }

      const supported = await checkSupport();
      if (!supported) {
        throw new Error('Step counting is not supported on this device');
      }

      const permission = await Pedometer.requestPermissions();
      if (permission.activityRecognition !== 'granted') {
        throw new Error('Permission denied for activity recognition');
      }

      if (measurementListener) {
        await measurementListener.remove();
      }

      measurementListener = await Pedometer.addListener('measurement', (data) => {
        console.log('Pedometer update received:', data);
        if (data.numberOfSteps !== undefined) {
          steps.value = data.numberOfSteps;
        }
      });

      await Pedometer.startMeasurementUpdates();
      isTracking.value = true;
    } catch (e) {
      error.value = e.message;
      console.error('Pedometer start error:', e);
    }
  }

  async function stopTracking() {
    try {
      await Pedometer.stopMeasurementUpdates();
      if (measurementListener) {
        await measurementListener.remove();
        measurementListener = null;
      }
      isTracking.value = false;
    } catch (e) {
      console.error('Pedometer stop error:', e);
    }
  }

  // Get historical data
  async function querySteps(startDate: Date, endDate: Date) {
    try {
      const result = await Pedometer.getMeasurement({
        startDate,
        endDate
      });
      return result.numberOfSteps || 0;
    } catch (e) {
      console.error('Error querying steps:', e);
      return 0;
    }
  }


  return {
    steps,
    isSupported,
    isTracking,
    error,
    checkSupport,
    startTracking,
    stopTracking,
    querySteps
  };
});