import { defineStore } from 'pinia';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
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
        console.log('Pedometer not supported on web');
        isSupported.value = false;
        return false;
      }

      const result = await CapacitorPedometer.isAvailable();
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

      // Check/Request permissions
      const permission = await CapacitorPedometer.checkPermissions();
      if (permission.activityRecognition !== 'granted') {
        const request = await CapacitorPedometer.requestPermissions();
        if (request.activityRecognition !== 'granted') {
          throw new Error('Permission denied for activity recognition');
        }
      }

      // Clean up existing listener if any
      if (measurementListener) {
        await measurementListener.remove();
      }

      // Start the actual hardware updates
      await CapacitorPedometer.startMeasurementUpdates();
      
      // Listen for step updates
      measurementListener = await CapacitorPedometer.addListener('measurement', (data) => {
        console.log('Pedometer update:', data);
        if (data.numberOfSteps !== undefined) {
          steps.value = data.numberOfSteps;
        }
      });

      isTracking.value = true;
    } catch (e) {
      error.value = e.message;
      console.error('Pedometer start error:', e);
      alert(`Pedometer Error: ${e.message}`);
    }
  }

  async function stopTracking() {
    try {
      await CapacitorPedometer.stopMeasurementUpdates();
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
      const result = await CapacitorPedometer.getMeasurement({
        start: startDate.getTime(),
        end: endDate.getTime()
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