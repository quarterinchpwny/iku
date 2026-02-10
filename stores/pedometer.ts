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
        console.log('Pedometer not supported on web');
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
      console.log('PEDO_LOG: 1. Checking Platform');
      const info = await Device.getInfo();
      if (info.platform === 'web') {
        throw new Error('Pedometer is not available on web platform');
      }

      console.log('PEDO_LOG: 2. Checking Support');
      const supported = await checkSupport();
      if (!supported) {
        throw new Error('Step counting is not supported on this device');
      }

      console.log('PEDO_LOG: 3. Checking Permissions');
      const permission = await Pedometer.checkPermissions();
      if (permission.activityRecognition !== 'granted') {
        console.log('PEDO_LOG: 4. Requesting Permissions');
        const request = await Pedometer.requestPermissions();
        if (request.activityRecognition !== 'granted') {
          throw new Error('Permission denied for activity recognition');
        }
      }

      if (measurementListener) {
        await measurementListener.remove();
      }

      console.log('PEDO_LOG: 5. Adding Listener');
      measurementListener = await Pedometer.addListener('measurement', (data) => {
        console.log('Pedometer update received:', data);
        if (data.numberOfSteps !== undefined) {
          steps.value = data.numberOfSteps;
        }
      });

      console.log('PEDO_LOG: 6. Delaying');
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('PEDO_LOG: 7. Starting Hardware');
      await Pedometer.startMeasurementUpdates();
      
      console.log('PEDO_LOG: 8. Success');
      isTracking.value = true;
    } catch (e) {
      error.value = e.message;
      console.error('Pedometer start error:', e);
      alert(`Pedometer Error: ${e.message}`);
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