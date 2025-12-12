import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Svg, { Circle, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Storage keys for persisting timer values
const STORAGE_KEYS = {
  MAIN_TIMER_MINUTES: '@timer_main_minutes',
  MAIN_TIMER_SECONDS: '@timer_main_seconds',
  GET_READY_MINUTES: '@timer_get_ready_minutes',
  GET_READY_SECONDS: '@timer_get_ready_seconds',
};

export default function TimerPage() {
  // Timer settings
  const [mainTimerMinutes, setMainTimerMinutes] = useState(1);
  const [mainTimerSeconds, setMainTimerSeconds] = useState(30);
  const [getReadyMinutes, setGetReadyMinutes] = useState(0);
  const [getReadySeconds, setGetReadySeconds] = useState(5);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(90); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [getReadyPlayed, setGetReadyPlayed] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longBeepCountRef = useRef(0);

  // Calculate total times
  const totalTime = mainTimerMinutes * 60 + mainTimerSeconds;
  const getReadyTime = getReadyMinutes * 60 + getReadySeconds;

  // Preload sounds for better Android performance
  const shortBeepSound = useRef<Audio.Sound | null>(null);
  const longBeepSound = useRef<Audio.Sound | null>(null);

  // Load saved timer values on component mount
  useEffect(() => {
    const loadTimerValues = async () => {
      try {
        const [savedMainMinutes, savedMainSeconds, savedGetReadyMinutes, savedGetReadySeconds] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.MAIN_TIMER_MINUTES),
          AsyncStorage.getItem(STORAGE_KEYS.MAIN_TIMER_SECONDS),
          AsyncStorage.getItem(STORAGE_KEYS.GET_READY_MINUTES),
          AsyncStorage.getItem(STORAGE_KEYS.GET_READY_SECONDS),
        ]);

        if (savedMainMinutes !== null) setMainTimerMinutes(parseInt(savedMainMinutes));
        if (savedMainSeconds !== null) setMainTimerSeconds(parseInt(savedMainSeconds));
        if (savedGetReadyMinutes !== null) setGetReadyMinutes(parseInt(savedGetReadyMinutes));
        if (savedGetReadySeconds !== null) setGetReadySeconds(parseInt(savedGetReadySeconds));
      } catch (error) {
        console.warn('Error loading timer values:', error);
      }
    };

    loadTimerValues();
  }, []);

  // Setup audio mode and preload sounds on component mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Configure audio mode for Android compatibility
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
          playThroughEarpieceAndroid: false,
        });

        // Preload short beep sound
        const { sound: shortSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/beep.wav'),
          { shouldPlay: false }
        );
        shortBeepSound.current = shortSound;

        // Preload long beep sound
        const { sound: longSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/beep.wav'),
          { shouldPlay: false }
        );
        longBeepSound.current = longSound;
      } catch (error) {
        console.warn('Error setting up audio:', error);
      }
    };

    setupAudio();

    // Cleanup sounds on unmount
    return () => {
      shortBeepSound.current?.unloadAsync();
      longBeepSound.current?.unloadAsync();
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            playLongBeep();
            setIsRunning(false);
            setIsPaused(false);
            setGetReadyPlayed(false);
            return 0;
          }

          // Check if we should play get ready beep
          if (prev === getReadyTime && !getReadyPlayed) {
            playShortBeep();
            setGetReadyPlayed(true);
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, getReadyTime, getReadyPlayed]);

  // Save timer values whenever they change
  useEffect(() => {
    const saveTimerValues = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.MAIN_TIMER_MINUTES, mainTimerMinutes.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.MAIN_TIMER_SECONDS, mainTimerSeconds.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.GET_READY_MINUTES, getReadyMinutes.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.GET_READY_SECONDS, getReadySeconds.toString()),
        ]);
      } catch (error) {
        console.warn('Error saving timer values:', error);
      }
    };

    saveTimerValues();
  }, [mainTimerMinutes, mainTimerSeconds, getReadyMinutes, getReadySeconds]);

  // Sound functions
  const playShortBeep = async () => {
    try {
      if (shortBeepSound.current) {
        // Reset position to start and play
        await shortBeepSound.current.setPositionAsync(0);
        await shortBeepSound.current.playAsync();
      }
    } catch (error) {
      console.warn('Error playing short beep:', error);
    }
  };

  const playLongBeep = async () => {
    try {
      if (!longBeepSound.current) return;

      longBeepCountRef.current = 0;

      // Set up listener to replay sound 3 times
      const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          longBeepCountRef.current += 1;

          if (longBeepCountRef.current < 3) {
            // Play again
            await longBeepSound.current?.setPositionAsync(0);
            await longBeepSound.current?.playAsync();
          } else {
            // Done playing, remove listener
            longBeepSound.current?.setOnPlaybackStatusUpdate(null);
          }
        }
      };

      // Set listener and start playing
      longBeepSound.current.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      await longBeepSound.current.setPositionAsync(0);
      await longBeepSound.current.playAsync();
    } catch (error) {
      console.warn('Error playing long beep:', error);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Button handlers
  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRunning) {
      setTimeLeft(totalTime);
      setIsRunning(true);
      setIsPaused(false);
      setGetReadyPlayed(false);
    } else if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeLeft(totalTime);
    setIsRunning(false);
    setIsPaused(false);
    setGetReadyPlayed(false);
    setModalVisible(false);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
  };

  // Circle calculations
  const size = 300;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const strokeDashoffset = circumference - progress * circumference;

  // Get ready line angle (in degrees, 0 is top, clockwise)
  const getReadyAngle = totalTime > 0 ? ((totalTime - getReadyTime) / totalTime) * 360 : 0;
  const getReadyRadians = ((getReadyAngle - 90) * Math.PI) / 180;
  const lineLength = 15;
  const lineX1 = size / 2 + (radius - lineLength / 2) * Math.cos(getReadyRadians);
  const lineY1 = size / 2 + (radius - lineLength / 2) * Math.sin(getReadyRadians);
  const lineX2 = size / 2 + (radius + lineLength / 2) * Math.cos(getReadyRadians);
  const lineY2 = size / 2 + (radius + lineLength / 2) * Math.sin(getReadyRadians);

  return (
    <View style={styles.container}>
      {/* Timer Circle */}
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#333333ff"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1a027ff"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
          {/* Purple get ready line */}
          {getReadyTime > 0 && getReadyTime < totalTime && (
            <Line
              x1={lineX1}
              y1={lineY1}
              x2={lineX2}
              y2={lineY2}
              stroke="#00b7ffff"
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
        </Svg>
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleEdit}
        disabled={isRunning && !isPaused}
      >
        <View style={styles.editButton}>
          <Text style={styles.buttonText}>Edit</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleStart}
      >
        <View style={styles.startButton}>
          <Text style={styles.buttonText}>
            {!isRunning ? 'Start' : isPaused ? 'Resume' : 'Pause'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Timers</Text>

            {/* Main Timer */}
            <Text style={styles.label}>Timer</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.input}
                value={mainTimerMinutes.toString()}
                onChangeText={(text) => setMainTimerMinutes(parseInt(text) || 0)}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={mainTimerSeconds.toString()}
                onChangeText={(text) => setMainTimerSeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.inputLabel}>sec</Text>
            </View>

            {/* Get Ready Timer */}
            <Text style={styles.label}>Get Ready Timer</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.input}
                value={getReadyMinutes.toString()}
                onChangeText={(text) => setGetReadyMinutes(parseInt(text) || 0)}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={getReadySeconds.toString()}
                onChangeText={(text) => setGetReadySeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.inputLabel}>sec</Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000000',
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  timerText: {
    position: 'absolute',
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  button: {
    width: 280,
    height: 65,
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
  },
  editButton: {
    backgroundColor: '#333333ff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  startButton: {
    backgroundColor: '#00b7ff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
    marginBottom: 8,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#333333',
    color: '#FFFFFF',
    fontSize: 18,
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    width: 60,
    marginHorizontal: 5,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  modalButton: {
    flex: 1,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#666666',
  },
  saveButton: {
    backgroundColor: '#00FF00',
  },
});
